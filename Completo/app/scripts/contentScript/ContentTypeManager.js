const _ = require('lodash')
const Events = require('./Events')
const URLUtils = require('../utils/URLUtils')
const LanguageUtils = require('../utils/LanguageUtils')
// const Alerts = require('../utils/Alerts')
const CryptoUtils = require('../utils/CryptoUtils')
const URL_CHANGE_INTERVAL_IN_SECONDS = 1
const axios = require('axios')

class ContentTypeManager {
  constructor () {
    this.pdfFingerprint = null
    this.documentURL = null
    this.urlChangeInterval = null
    this.urlParam = null
    this.documentType = ContentTypeManager.documentTypes.html // By default document type is html
    this.localFile = false
  }

  init (callback) {
    if (document.querySelector('embed[type="application/pdf"][name="plugin"]')) {
      window.location = chrome.extension.getURL('content/pdfjs/web/viewer.html') + '?file=' + encodeURIComponent(window.location.href)
    } else {
      // Try to load doi from the document, page metadata or URL hash param
      this.tryToLoadDoi()
      this.tryToLoadPublicationPDF()
      this.tryToLoadURLParam()
      this.tryToLoadTitle()
      // TODO this.tryToLoadLocalFIleURL() from file metadata
      // If current web is pdf viewer.html, set document type as pdf
      if (window.location.pathname === '/content/pdfjs/web/viewer.html') {
        // Save document type as pdf
        this.documentType = ContentTypeManager.documentTypes.pdf
        // Load content type metadata
        this.loadPDFDocumentContentType(callback)
      } else {
        // Save document type as html
        this.documentType = ContentTypeManager.documentTypes.html
        // Load content type metadata
        this.loadHTMLDocumentContentType(callback)
      }
    }
  }

  loadPDFDocumentContentType (callback) {
    this.waitUntilPDFViewerLoad(() => {
      // Save pdf fingerprint
      this.pdfFingerprint = window.PDFViewerApplication.pdfDocument.pdfInfo.fingerprint
      // Get document URL
      if (this.urlParam) {
        this.documentURL = this.urlParam
      } else {
        if (window.PDFViewerApplication.url.startsWith('file:///')) {
          // Is a local file
          this.localFile = true
        } else {
          // Is a web file with URL
          this.localFile = false
          this.documentURL = window.PDFViewerApplication.url
        }
      }
      let promise = Promise.resolve()

      promise.then(() => {
        if (_.isFunction(callback)) {
          callback()
        }
      })
    })
  }

  loadHTMLDocumentContentType (callback) {
    // Get document URL
    if (this.urlParam) {
      this.documentURL = this.urlParam
    } else {
      if (window.location.href.startsWith('file:///')) {
        // Is a local file
        this.localFile = true
        this.tryToLoadPlainTextFingerprint()
      } else {
        // Is a web file with URL
        this.localFile = false
        this.documentURL = URLUtils.retrieveMainUrl(window.location.href)
        // Initialize web url change observer
        this.initSupportWebURLChange()
      }
    }
    let promise = Promise.resolve()

    promise.then(() => {
      if (_.isFunction(callback)) {
        callback()
      }
    })
  }

  destroy (callback) {
    if (this.documentType === ContentTypeManager.documentTypes.pdf) {
      // Reload to original pdf website
      if (_.isUndefined(this.documentURL) || _.isNull(this.documentURL)) {
        window.location.href = window.PDFViewerApplication.baseUrl
      } else {
        window.location.href = this.documentURL
      }
    } else {
      if (_.isFunction(callback)) {
        callback()
      }
    }
    clearInterval(this.urlChangeInterval)
  }

  waitUntilPDFViewerLoad (callback) {
    let interval = setInterval(() => {
      if (_.isObject(window.PDFViewerApplication.pdfDocument)) {
        clearInterval(interval)
        if (_.isFunction(callback)) {
          callback(window.PDFViewerApplication)
        }
      }
    }, 500)
  }

  tryToLoadDoi () {
    // Try to load doi from hash param
    let decodedUri = decodeURIComponent(window.location.href)
    let params = URLUtils.extractHashParamsFromUrl(decodedUri)
    if (!_.isEmpty(params) && !_.isEmpty(params.doi)) {
      this.doi = params.doi
    }
    // Try to load doi from page metadata
    if (_.isEmpty(this.doi)) {
      try {
        this.doi = document.querySelector('meta[name="citation_doi"]').content
      } catch (e) {
        console.debug('Doi not found for this document')
      }
    }
    // TODO Try to load doi from chrome tab storage
  }

  tryToLoadURLParam () {
    let decodedUri = decodeURIComponent(window.location.href)
    let params = URLUtils.extractHashParamsFromUrl(decodedUri, '::')
    if (!_.isEmpty(params) && !_.isEmpty(params.url)) {
      this.urlParam = params.url
    }
  }

  tryToLoadPublicationPDF () {
    try {
      this.citationPdf = document.querySelector('meta[name="citation_pdf_url"]').content
    } catch (e) {
      console.debug('citation pdf url not found')
    }
  }

  getDocumentRootElement () {
    if (this.documentType === ContentTypeManager.documentTypes.pdf) {
      return document.querySelector('#viewer')
    } else if (this.documentType === ContentTypeManager.documentTypes.html) {
      return document.body
    }
  }

  getDocumentURIToSearchInHypothesis () {
    if (this.documentType === ContentTypeManager.documentTypes.pdf) {
      return 'urn:x-pdf:' + this.pdfFingerprint
    } else if (this.documentFingerprint) {
      return 'urn:x-txt:' + this.documentFingerprint
    } else {
      return this.documentURL
    }
  }

  getDocumentURIToSaveInHypothesis () {
    if (this.localFile) {
      return 'urn:x-pdf:' + this.pdfFingerprint
    } else {
      return this.documentURL
    }
  }

  initSupportWebURLChange () {
    this.urlChangeInterval = setInterval(() => {
      let newUrl = URLUtils.retrieveMainUrl(window.location.href)
      if (newUrl !== this.documentURL) {
        console.debug('Document URL updated from %s to %s', this.documentURL, newUrl)
        this.documentURL = newUrl
        // Dispatch event
        LanguageUtils.dispatchCustomEvent(Events.updatedDocumentURL, {url: this.documentURL})
      }
    }, URL_CHANGE_INTERVAL_IN_SECONDS * 1000)
  }

  tryToLoadPlainTextFingerprint () {
    let fileTextContentElement = document.querySelector('body > pre')
    if (fileTextContentElement) {
      let fileTextContent = fileTextContentElement.innerText
      this.documentFingerprint = CryptoUtils.hash(fileTextContent.innerText)
    }
  }

  getDocumentURIs () {
    let uris = []
    if (this.doi) {
      uris.push('https://doi.org/' + this.doi)
    }
    if (this.documentURL) {
      uris.push(this.documentURL)
    }
    if (this.pdfFingerprint) {
      uris.push('urn:x-pdf:' + this.pdfFingerprint)
    }
    if (this.documentFingerprint) {
      uris.push('urn:x-txt:' + this.documentFingerprint)
    }
    return uris
  }

  getDocumentLink () {
    let uris = this.getDocumentURIs()
    return _.map(uris, (uri) => {
      return {href: uri}
    })
  }

  getDocumentFingerprint () {
    if (this.pdfFingerprint) {
      return this.pdfFingerprint
    } else if (this.documentFingerprint) {
      return this.documentFingerprint
    } else {
      return null
    }
  }

  tryToLoadTitle () {
    // Try to load by doi
    let promise = new Promise((resolve, reject) => {
      if (this.doi) {
        let settings = {
          'async': true,
          'crossDomain': true,
          'url': 'https://doi.org/' + this.doi,
          'method': 'GET',
          'headers': {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache'
          }
        }
        // Call using axios
        axios(settings).then((response) => {
          if (response.data && response.data.title) {
            this.documentTitle = response.data.title
          }
          resolve()
        })
      } else {
        resolve()
      }
    })
    promise.then(() => {
      // Try to load title from page metadata
      if (_.isEmpty(this.documentTitle)) {
        try {
          let documentTitleElement = document.querySelector('meta[name="citation_title"]')
          if (!_.isNull(documentTitleElement)) {
            this.documentTitle = documentTitleElement.content
          }
          if (!this.documentTitle) {
            let documentTitleElement = document.querySelector('meta[property="og:title"]')
            if (!_.isNull(documentTitleElement)) {
              this.documentTitle = documentTitleElement.content
            }
            if (!this.documentTitle) {
              let promise = new Promise((resolve, reject) => {
                // Try to load title from pdf metadata
                if (this.documentType === ContentTypeManager.documentTypes.pdf) {
                  this.waitUntilPDFViewerLoad(() => {
                    if (window.PDFViewerApplication.documentInfo.Title) {
                      this.documentTitle = window.PDFViewerApplication.documentInfo.Title
                    }
                    resolve()
                  })
                } else {
                  resolve()
                }
              })
              promise.then(() => {
                // Try to load title from document title
                if (!this.documentTitle) {
                  this.documentTitle = document.title || 'Unknown document'
                }
              })
            }
          }
        } catch (e) {
          console.debug('Title not found for this document')
        }
      }
    })
  }
}

ContentTypeManager.documentTypes = {
  html: {
    name: 'html',
    selectors: ['FragmentSelector', 'RangeSelector', 'TextPositionSelector', 'TextQuoteSelector']
  },
  pdf: {
    name: 'pdf',
    selectors: ['FragmentSelector', 'TextPositionSelector', 'TextQuoteSelector']
  }
}

module.exports = ContentTypeManager
