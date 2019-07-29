const jsYaml = require('js-yaml')
const Theme = require('./Theme')
const Code = require('./Code')
const Config = require('../Config')
const _ = require('lodash')
const LanguageUtils = require('../utils/LanguageUtils')
const Hypothesis = require('../storage/hypothesis/Hypothesis')
const ColorUtils = require('../utils/ColorUtils')

class AnnotationGuide {
  constructor ({id = null, name = '', storage = null}) {
    this.id = id
    this.name = name
    this.themes = []
    this.storage = storage
  }

  toAnnotation () {
    return {
      name: this.name,
      group: this.storage.group.id,
      permissions: {
        read: ['group:' + this.storage.group.id]
      },
      references: [],
      motivation: 'defining',
      tags: ['motivation:defining', Config.namespace + ':guide'],
      target: [],
      text: jsYaml.dump({
      }),
      uri: this.storage.group.links.html
    }
  }

  toAnnotations () {
    let annotations = []
    // Create annotation for current element
    annotations.push(this.toAnnotation())
    // Create annotations for all criterias
    for (let i = 0; i < this.themes.length; i++) {
      annotations = annotations.concat(this.themes[i].toAnnotations())
    }
    return annotations
  }

  static fromAnnotation (annotation) {
    let storage
    storage = new Hypothesis({group: window.abwa.groupSelector.currentGroup})
    let annotationGuideOpts = {id: annotation.id, name: annotation.name, storage: storage}
    return new AnnotationGuide(annotationGuideOpts)
  }

  static fromAnnotations (annotations) {
    // return AnnotationGuide
    let guideAnnotation = _.remove(annotations, (annotation) => {
      return _.some(annotation.tags, (tag) => { return tag === 'oa:guide' })
    })
    let guide
    if (guideAnnotation.length === 1) {
      guide = AnnotationGuide.fromAnnotation(guideAnnotation[0])
    } else {
      return null
    }
    // TODO Complete the guide from the annotations
    // For the rest of annotations, get themes and codes
    let themeAnnotations = _.remove(annotations, (annotation) => {
      return _.some(annotation.tags, (tag) => {
        return tag.includes('oa:theme:')
      })
    })
    let codeAnnotations = _.remove(annotations, (annotation) => {
      return _.some(annotation.tags, (tag) => {
        return tag.includes('oa:code:')
      })
    })
    for (let i = 0; i < themeAnnotations.length; i++) {
      let theme = Theme.fromAnnotation(themeAnnotations[i], guide)
      if (LanguageUtils.isInstanceOf(theme, Theme)) {
        guide.themes.push(theme)
      }
    }
    for (let i = 0; i < codeAnnotations.length; i++) {
      let codeAnnotation = codeAnnotations[i]
      // Get theme corresponding to the level
      let themeTag = _.find(codeAnnotation.tags, (tag) => {
        return tag.includes('oa:isCodeOf:')
      })
      let themeName = themeTag.replace('oa:isCodeOf:', '')
      let theme = _.find(guide.themes, (theme) => {
        return theme.name === themeName
      })
      let code = Code.fromAnnotation(codeAnnotation, theme)
      if (LanguageUtils.isInstanceOf(theme, Theme)) {
        theme.codes.push(code)
      } else {
        console.debug('Code %s has no theme', code.name)
      }
    }
    return guide
  }

  static fromUserDefinedHighlighterDefinition (userDefinedHighlighterDefinition) {
    let annotationGuide = new AnnotationGuide({name: userDefinedHighlighterDefinition.name})
    for (let i = 0; i < userDefinedHighlighterDefinition.definition.length; i++) {
      let themeDefinition = userDefinedHighlighterDefinition.definition[i]
      let theme = new Theme({name: themeDefinition.name, description: themeDefinition.description, annotationGuide})
      theme.codes = []
      if (_.isArray(themeDefinition.codes)) {
        for (let j = 0; j < themeDefinition.codes.length; j++) {
          let codeDefinition = themeDefinition.codes[j]
          let code = new Code({name: codeDefinition.name, description: codeDefinition.description, theme: theme})
          theme.codes.push(code)
        }
      }
      annotationGuide.themes.push(theme)
    }
    return annotationGuide
  }

  getCodeOrThemeFromId (id) {
    let theme = _.find(this.themes, (theme) => {
      return theme.id === id
    })
    if (!LanguageUtils.isInstanceOf(theme, Theme)) {
      // Look for code inside themes
      for (let i = 0; i < this.themes.length; i++) {
        let theme = this.themes[i]
        let code = _.find(theme.codes, (code) => {
          return code.id === id
        })
        if (LanguageUtils.isInstanceOf(code, Code)) {
          return code
        }
      }
      return null
    } else {
      return theme
    }
  }

  addTheme (theme) {
    if (LanguageUtils.isInstanceOf(theme, Theme)) {
      this.themes.push(theme)
      // Get new color for the theme
      let colors = ColorUtils.getDifferentColors(this.themes.length)
      let lastColor = colors.pop()
      theme.color = ColorUtils.setAlphaToColor(lastColor, Config.colors.minAlpha)
    }
  }

  removeTheme (theme) {
    _.remove(this.themes, theme)
  }
}

module.exports = AnnotationGuide
