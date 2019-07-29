const Config = {
  groupName: 'Annotations',
  namespace: 'oa',
  urlParamName: 'spl', // Name to activate the extension if the url contains this hash param
  tags: { // Defined tags for the domain
    grouped: { // Grouped annotations
      group: 'theme',
      subgroup: 'code',
      relation: 'isCodeOf'
    },
    motivation: 'motivation'
  },
  colors: {
    minAlpha: 0.2,
    maxAlpha: 0.8
  }
}

module.exports = Config
