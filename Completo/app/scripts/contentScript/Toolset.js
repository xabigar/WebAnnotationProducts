const axios = require('axios')
const _ = require('lodash')
const Canvas = require('../consumption/visualizations/Canvas')
const Screenshots = require('../consumption/visualizations/Screenshots')
const GoogleSheetGenerator = require('../consumption/visualizations/GoogleSheetGenerator')
const Resume = require('../consumption/visualizations/Resume')
const TextSummary = require('../consumption/visualizations/TextSummary')
const DeleteGroup = require('../groupManipulation/DeleteGroup')
const $ = require('jquery')

class Toolset {
  constructor () {
    this.page = chrome.extension.getURL('pages/sidebar/toolset.html')
  }

  init (callback) {
    axios.get(this.page).then((response) => {
      // Get sidebar container
      this.sidebarContainer = document.querySelector('#abwaSidebarContainer')
      // Insert toolset container
      let groupSelectorContainer = this.sidebarContainer.querySelector('#groupSelectorContainer')
      groupSelectorContainer.insertAdjacentHTML('afterend', response.data)
      this.toolsetContainer = this.sidebarContainer.querySelector('#toolset')
      this.toolsetHeader = this.toolsetContainer.querySelector('#toolsetHeader')
      this.toolsetBody = this.sidebarContainer.querySelector('#toolsetBody')
      let toolsetButtonTemplate = this.sidebarContainer.querySelector('#toolsetButtonTemplate')
      // Set screenshot image
      let screenshotImageUrl = chrome.extension.getURL('/images/screenshot.png')
      this.screenshotImage = $(toolsetButtonTemplate.content.firstElementChild).clone().get(0)
      this.screenshotImage.src = screenshotImageUrl
      this.screenshotImage.title = 'Take a screenshot of the current document' // TODO i18n
      this.toolsetBody.appendChild(this.screenshotImage)
      this.screenshotImage.addEventListener('click', () => {
        this.screenshotButtonHandler()
      })
      // Set Canvas image
      let canvasImageUrl = chrome.extension.getURL('/images/overview.png')
      this.canvasImage = $(toolsetButtonTemplate.content.firstElementChild).clone().get(0)
      this.canvasImage.src = canvasImageUrl
      this.canvasImage.title = 'Generate canvas' // TODO i18n
      this.toolsetBody.appendChild(this.canvasImage)
      this.canvasImage.addEventListener('click', () => {
        this.canvasButtonHandler()
      })
      // Set TextSummary image
      let textSummaryImageUrl = chrome.extension.getURL('/images/generator.png')
      this.textSummaryImage = $(toolsetButtonTemplate.content.firstElementChild).clone().get(0)
      this.textSummaryImage.src = textSummaryImageUrl
      this.textSummaryImage.title = 'Generate review report' // TODO i18n
      this.toolsetBody.appendChild(this.textSummaryImage)
      this.textSummaryImage.addEventListener('click', () => {
        this.textSummaryButtonHandler()
      })
      // Set DeleteGroup image
      let deleteGroupImageUrl = chrome.extension.getURL('/images/deleteAnnotations.png')
      this.deleteGroupImage = $(toolsetButtonTemplate.content.firstElementChild).clone().get(0)
      this.deleteGroupImage.src = deleteGroupImageUrl
      this.deleteGroupImage.title = 'Delete all annotations in document' // TODO i18n
      this.toolsetBody.appendChild(this.deleteGroupImage)
      this.deleteGroupImage.addEventListener('click', () => {
        this.deleteGroupButtonHandler()
      })
      // Set GoToLast image
      let goToLastImageUrl = chrome.extension.getURL('/images/resume.png')
      this.goToLastImage = $(toolsetButtonTemplate.content.firstElementChild).clone().get(0)
      this.goToLastImage.src = goToLastImageUrl
      this.goToLastImage.title = 'Go to last annotation' // TODO i18n
      this.toolsetBody.appendChild(this.goToLastImage)
      this.goToLastImage.addEventListener('click', () => {
        this.goToLastButtonHandler()
      })
      // Set Spreadsheet generation image
      let googleSheetImageUrl = chrome.extension.getURL('/images/googleSheet.svg')
      this.googleSheetImage = $(toolsetButtonTemplate.content.firstElementChild).clone().get(0)
      this.googleSheetImage.src = googleSheetImageUrl
      this.googleSheetImage.title = 'Go to last annotation' // TODO i18n
      this.toolsetBody.appendChild(this.googleSheetImage)
      this.googleSheetImage.addEventListener('click', () => {
        this.generateGoogleSheet()
      })
      // Check if exist any element in the tools and show it
      if (!_.isEmpty(this.toolsetBody.innerHTML)) {
        this.show()
      }
      if (_.isFunction(callback)) {
        callback()
      }
    })
  }
  screenshotButtonHandler () {
    Screenshots.takeScreenshot()
  }
  canvasButtonHandler () {
    Canvas.generateCanvas()
  }
  textSummaryButtonHandler () {
    TextSummary.generateReview()
  }
  deleteGroupButtonHandler () {
    DeleteGroup.deleteAnnotations()
  }
  goToLastButtonHandler () {
    Resume.resume()
  }
  generateGoogleSheet () {
    GoogleSheetGenerator.generate()
  }

  /**
   * Show toolset in sidebar
   */
  show () {
    // Toolset aria-hidden is false
    this.toolsetContainer.setAttribute('aria-hidden', 'false')
  }

  /**
   * Hide toolset in sidebar
   */
  hide () {
    // Toolset aria-hidden is true
    this.toolsetContainer.setAttribute('aria-hidden', 'true')
  }

  destroy () {
    this.toolsetContainer.remove()
  }
}

module.exports = Toolset
