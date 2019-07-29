const GoogleSheetClient = require('../googleSheets/GoogleSheetClient')
const _ = require('lodash')

class GoogleSheetsManager {
  constructor () {
    this.googleSheetClient = null
  }

  init () {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.scope === 'googleSheets') {
        if (request.cmd === 'getToken') {
          chrome.identity.getAuthToken({ 'interactive': true }, function (token) {
            if (chrome.runtime.lastError) {
              sendResponse({ error: chrome.runtime.lastError })
            } else {
              sendResponse({ token: token })
            }
          })
          return true
        } else if (request.cmd === 'getTokenSilent') {
          chrome.identity.getAuthToken({ 'interactive': false }, function (token) {
            if (chrome.runtime.lastError) {
              sendResponse({ error: chrome.runtime.lastError })
            } else {
              sendResponse({ token: token })
            }
          })
          return true
        } else if (request.cmd === 'createSpreadsheet') {
          chrome.identity.getAuthToken({ 'interactive': true }, function (token) {
            if (_.isUndefined(token)) {
              sendResponse({error: new Error('Unable to retrieve token, please check if you have synced your browser and your google account. If the application did not ask you for login, please contact developer.')})
            } else {
              this.googleSheetClient = new GoogleSheetClient(token)
              this.googleSheetClient.createSpreadsheet(request.data, (err, result) => {
                if (err) {
                  sendResponse({error: err})
                } else {
                  sendResponse(result)
                }
              })
            }
          })
          return true
        } else if (request.cmd === 'updateSpreadsheet') {
          chrome.identity.getAuthToken({ 'interactive': true }, function (token) {
            this.googleSheetClient = new GoogleSheetClient(token)
            this.googleSheetClient.updateSheetCells(request.data, (err, result) => {
              if (err) {
                sendResponse({error: err})
              } else {
                sendResponse(result)
              }
            })
          })
          return true
        }
      }
    })
  }
}

module.exports = GoogleSheetsManager
