const _ = require('lodash')
const $ = require('jquery')
const Alerts = require('../utils/Alerts')
const Config = require('../Config')
const ChromeStorage = require('../utils/ChromeStorage')
const LanguageUtils = require('../utils/LanguageUtils')
// const ImportSchema = require('./ImportSchema')
const GroupName = Config.groupName
const selectedGroupNamespace = 'hypothesis.currentGroup'
const HypothesisClientManager = require('../storage/hypothesis/HypothesisClientManager')
// const Events = require('../contentScript/Events')
// const LocalStorageManager = require('../storage/local/LocalStorageManager')
const checkHypothesisLoggedInWhenPromptInSeconds = 2 // When not logged in, check if user has logged in

class GroupSelector {
  constructor () {
    this.selectedGroupNamespace = 'groupManipulation.currentGroup'
    this.groups = null
    this.currentGroup = null
    this.user = {}
  }

  init (callback) {
    console.debug('Initializing group selector')
    this.checkIsLoggedIn((err) => {
      if (err) {
        // Stop propagating the rest of the functions, because it is not logged in storage
        // Show that user need to log in remote storage to continue
        Alerts.errorAlert({
          title: 'Log in selected storage required',
          text: chrome.i18n.getMessage('StorageLoginRequired')
        })
      } else {
        // Retrieve user profile (for further uses in other functionalities of the tool)
        this.retrieveUserProfile(() => {
          // Define current group
          this.defineCurrentGroup(() => {
            this.reloadGroupsContainer()
            console.debug('Initialized group selector')
            if (_.isFunction(callback)) {
              callback(null)
            }
          })
        })
      }
    })
  }

  defineCurrentGroup (callback) {
    // If initialization annotation is set
    if (window.abwa.annotationBasedInitializer.initAnnotation) {
      let annotationGroupId = window.abwa.annotationBasedInitializer.initAnnotation.group
      // Load group of annotation
      this.retrieveGroups((err, groups) => {
        if (err) {
          if (_.isFunction(callback)) {
            callback(err)
          }
        } else {
          // Set current group
          this.currentGroup = _.find(groups, (group) => { return group.id === annotationGroupId })
          // Save to chrome storage current group
          ChromeStorage.setData(selectedGroupNamespace, {data: JSON.stringify(this.currentGroup)}, ChromeStorage.local)
          if (_.isFunction(callback)) {
            callback()
          }
        }
      })
    } else {
      this.retrieveUserProfile(() => {
        // Load all the groups belonged to current user
        this.retrieveGroups((err, groups) => {
          if (err) {

          } else {
            ChromeStorage.getData(this.selectedGroupNamespace, ChromeStorage.local, (err, savedCurrentGroup) => {
              if (!err && !_.isEmpty(savedCurrentGroup) && _.has(savedCurrentGroup, 'data')) {
                // Parse saved current group
                try {
                  let savedCurrentGroupData = JSON.parse(savedCurrentGroup.data)
                  let currentGroup = _.find(this.groups, (group) => {
                    return group.id === savedCurrentGroupData.id
                  })
                  // Check if group exists in current user
                  if (_.isObject(currentGroup)) {
                    this.currentGroup = currentGroup
                  }
                } catch (e) {
                  // Nothing to do
                }
              }
              // If group cannot be retrieved from saved in extension storage
              // Try to load a group with defaultName
              if (_.isEmpty(this.currentGroup)) {
                this.currentGroup = _.find(window.abwa.groupSelector.groups, (group) => { return group.name === GroupName })
              }
              /*
              // If local annotation storage is selected, open any other group as all of them are for review&go
              if (_.isEmpty(this.currentGroup) && LanguageUtils.isInstanceOf(window.abwa.storageManager, LocalStorageManager)) {
                this.currentGroup = _.first(window.abwa.groupSelector.groups)
              } */
              if (_.isEmpty(this.currentGroup)) {
                // TODO i18n
                Alerts.loadingAlert({
                  title: 'First time reviewing?',
                  text: 'It seems that it is your first time using Review&Go. We are configuring everything to start reviewing.',
                  position: Alerts.position.center
                })
                // TODO Create default group
                this.createApplicationBasedGroupForUser((err, group) => {
                  if (err) {
                    Alerts.errorAlert({text: 'We are unable to create Hypothes.is group for Review&Go. Please check if you are logged in Hypothes.is.'})
                  } else {
                    this.currentGroup = group
                    callback(null)
                  }
                })
              }
            })
          }
        })
      })
    }
  }

  checkIsLoggedIn (callback) {
    let sidebarURL = chrome.extension.getURL('pages/sidebar/groupSelection.html')
    $.get(sidebarURL, (html) => {
      // Append sidebar to content
      $('#abwaSidebarContainer').append($.parseHTML(html))
      if (!window.abwa.storageManager.isLoggedIn()) {
        // Display login/sign up form
        $('#notLoggedInGroupContainer').attr('aria-hidden', 'false')
        // Hide group container
        $('#loggedInGroupContainer').attr('aria-hidden', 'true')
        // Hide purposes wrapper
        $('#purposesWrapper').attr('aria-hidden', 'true')
        // Start listening to when is logged in continuously
        chrome.runtime.sendMessage({scope: 'hypothesis', cmd: 'startListeningLogin'})
        // Open the sidebar to notify user that needs to log in
        window.abwa.sidebar.openSidebar()
        if (_.isFunction(callback)) {
          callback(new Error('Is not logged in'))
        }
      } else {
        if (_.isFunction(callback)) {
          callback()
        }
      }
    })
  }

  createApplicationBasedGroupForUser (callback) {
    window.abwa.storageManager.client.createNewGroup({name: Config.groupName}, callback)
  }

  addGroupSelectorToSidebar (callback) {
    let sidebarURL = chrome.extension.getURL('pages/sidebar/groupSelection.html')
    $.get(sidebarURL, (html) => {
      // Append sidebar to content
      $('#abwaSidebarContainer').append($.parseHTML(html))
      if (_.isFunction(callback)) {
        callback()
      }
    })
  }

  reloadGroupsContainer (callback) {
    if (window.abwa.storageManager.isLoggedIn()) {
      // Hide login/sign up form
      $('#notLoggedInGroupContainer').attr('aria-hidden', 'true')
      // Display group container
      $('#loggedInGroupContainer').attr('aria-hidden', 'false')
      // Set current group if not defined
      this.defineCurrentGroup(() => {
        // Render groups container
        this.renderGroupsContainer(() => {
          if (_.isFunction(callback)) {
            callback()
          }
        })
      })
    } else {
      // Display login/sign up form
      $('#notLoggedInGroupContainer').attr('aria-hidden', 'false')
      // Hide group container
      $('#loggedInGroupContainer').attr('aria-hidden', 'true')
      // Hide purposes wrapper
      $('#purposesWrapper').attr('aria-hidden', 'true')
      // Init isLogged checking
      this.initIsLoggedChecking()
      // Open the sidebar to show that login is required
      window.abwa.sidebar.openSidebar()
      if (_.isFunction(callback)) {
        callback()
      }
    }
  }

  renderGroupsContainer (callback) {
    // Display group selector and purposes selector
    $('#purposesWrapper').attr('aria-hidden', 'false')
    // Retrieve groups
    this.retrieveGroups((groups) => {
      console.debug(groups)
      let dropdownMenu = document.querySelector('#groupSelector')
      dropdownMenu.innerHTML = '' // Remove all groups
      this.groups.forEach(group => {
        let groupSelectorItem = document.createElement('option')
        groupSelectorItem.dataset.groupId = group.id
        groupSelectorItem.innerText = group.name
        groupSelectorItem.className = 'dropdown-item'
        dropdownMenu.appendChild(groupSelectorItem)
      })
      // Set select option
      $('#groupSelector').find('option[data-group-id="' + this.currentGroup.id + '"]').prop('selected', 'selected')
      // Set event handler for group change
      this.setEventForGroupSelectChange()
      if (_.isFunction(callback)) {
        callback()
      }
    })
  }

  setEventForGroupSelectChange () {
    let menu = document.querySelector('#groupSelector')
    $(menu).change(() => {
      let selectedGroup = $('#groupSelector').find('option:selected').get(0)
      this.updateCurrentGroupHandler(selectedGroup.dataset.groupId)
    })
  }

  updateCurrentGroupHandler (groupId) {
    this.currentGroup = _.find(this.groups, (group) => { return groupId === group.id })
    ChromeStorage.setData(selectedGroupNamespace, {data: JSON.stringify(this.currentGroup)}, ChromeStorage.local, () => {
      console.debug('Group updated. Name: %s id: %s', this.currentGroup.name, this.currentGroup.id)
      // Dispatch event
      LanguageUtils.dispatchCustomEvent(GroupSelector.eventGroupChange, {
        group: this.currentGroup,
        time: new Date()
      })
    })
  }

  retrieveGroups (callback) {
    window.abwa.storageManager.client.getListOfGroups({}, (err, groups) => {
      if (err) {
        if (_.isFunction(callback)) {
          callback(err)
        }
      } else {
        this.groups = groups
        // Remove public group in hypothes.is
        if (LanguageUtils.isInstanceOf(window.abwa.storageManager, HypothesisClientManager)) {
          _.remove(this.groups, (group) => {
            return group.id === '__world__'
          })
        }
        if (_.isFunction(callback)) {
          callback(null, groups)
        }
      }
    })
  }

  retrieveUserProfile (callback) {
    window.abwa.storageManager.client.getUserProfile((err, profile) => {
      if (err) {
        if (_.isFunction(callback)) {
          callback(err)
        }
      } else {
        this.user = profile
        if (_.isFunction(callback)) {
          callback(null, profile.groups)
        }
      }
    })
  }

  getCreatorData () {
    if (this.user) {
      if (this.user.metadata) {
        if (this.user.metadata.orcid) {
          return 'https://orcid.org/' + this.user.metadata.orcid
        } else if (this.user.metadata.link) {
          return this.user.metadata.link
        } else {
          return 'https://hypothes.is/users/' + this.user.userid.replace('acct:', '').replace('@hypothes.is', '')
        }
      } else {
        return 'https://hypothes.is/users/' + this.user.userid.replace('acct:', '').replace('@hypothes.is', '')
      }
    } else {
      return null
    }
  }

  destroy (callback) {
    // Destroy intervals
    if (this.loggedInInterval) {
      clearInterval(this.loggedInInterval)
    }
    if (_.isFunction(callback)) {
      callback()
    }
  }
}

GroupSelector.eventGroupChange = 'hypothesisGroupChanged'

module.exports = GroupSelector
