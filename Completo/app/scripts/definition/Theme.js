const jsYaml = require('js-yaml')
const _ = require('lodash')
const Config = require('../Config')
const ColorUtils = require('../utils/ColorUtils')

class Theme {
  constructor ({id, name, color, annotationGuide, description}) {
    this.id = id
    this.name = name
    this.color = color
    this.annotationGuide = annotationGuide
    this.description = description
    this.codes = []
  }

  toAnnotations () {
    let annotations = []
    // Create its annotations
    annotations.push(this.toAnnotation())
    // Create its children annotations
    for (let i = 0; i < this.codes.length; i++) {
      annotations = annotations.concat(this.codes[i].toAnnotations())
    }
    return annotations
  }

  toAnnotation () {
    let themeTag = Config.namespace + ':' + Config.tags.grouped.group + ':' + this.name
    let motivationTag = Config.namespace + ':' + Config.tags.motivation + ':' + 'codebookDevelopment'
    let tags = [themeTag, motivationTag]
    return {
      group: this.annotationGuide.storage.group.id,
      permissions: {
        read: ['group:' + this.annotationGuide.storage.group.id]
      },
      motivation: 'codebookDevelopment',
      references: [],
      tags: tags,
      target: [],
      text: jsYaml.dump({
        description: this.description
      }),
      uri: this.annotationGuide.storage.group.links.html
    }
  }

  static fromAnnotations () {
    // TODO Xabi
  }

  static fromAnnotation (annotation, annotationGuide = {}) {
    let themeTag = _.find(annotation.tags, (tag) => {
      return tag.includes('oa:theme:')
    })
    if (_.isString(themeTag)) {
      let name = themeTag.replace('oa:theme:', '')
      let config = jsYaml.load(annotation.text)
      if (_.isObject(config)) {
        let description = config.description
        let id = annotation.id
        return new Theme({id, name, description, annotationGuide})
      } else {

      }
    } else {
      console.error('Unable to retrieve criteria from annotation')
    }
  }

  addCode (code) {
    this.codes.push(code)
    // Re-set colors for each code
    this.reloadColorsForCodes()
  }

  removeCode (code) {
    _.remove(this.codes, code)
    // Re-set colors for each code
    this.reloadColorsForCodes()
  }

  reloadColorsForCodes () {
    this.codes.forEach((code, j) => {
      let alphaForChild = (Config.colors.maxAlpha - Config.colors.minAlpha) / this.codes.length * (j + 1) + Config.colors.minAlpha
      code.color = ColorUtils.setAlphaToColor(this.color, alphaForChild)
    })
  }
}

module.exports = Theme
