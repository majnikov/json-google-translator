#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { Translate } = require('@google-cloud/translate');
const _ = require('lodash');

const API_KEY = process.env.key;
const inputFileName = process.env.input_file;
const targetLanguages = process.env.target_languages && process.env.target_languages.split(',');
const sourceLanguage = process.env.source_language;

if (!API_KEY || !inputFileName || !targetLanguages || !sourceLanguage) {
  console.error('You must provide all the arguments.');
  console.log('key(api key), input_file, source_language, target_languages');
  return;
}

if (!fs.existsSync(inputFileName)) {
  console.error(`There is no ${inputFileName} file`);
  return;
}

const inputFile = JSON.parse(fs.readFileSync(path.resolve(inputFileName), 'utf-8'));

const translate = new Translate({
  key: API_KEY
});

function iterLeaves(value, keyChain, accumulator, translateOptions) {
  accumulator = accumulator || {};
  keyChain = keyChain || [];

  if (_.isObject(value)) {
    return _.chain(value).reduce((handlers, v, k) => {
      return handlers.concat(iterLeaves(v, keyChain.concat(k), accumulator, translateOptions));
    }, []).flattenDeep().value();
  } else {
    return function () {

      // Keeping url as is
      if (value.startsWith('/')) {
        _.set(accumulator, keyChain, value);

        return Promise.resolve(accumulator);
      }

      return translate
        .translate(value, translateOptions)
        .then((result) => {
          const translatedText = result[0];

          console.log(`Translated ${value} ===> ${translatedText} (${translateOptions.to})`);

          _.set(accumulator, keyChain, translatedText);
          return accumulator;
        })
        .catch(error => {
          console.warn(error);
        });
    }
  }
}

targetLanguages.forEach(language => {

  const options = {
    from: sourceLanguage,
    to: language
  };

  const outputFile = `${language}.json`;

  _.reduce(iterLeaves(inputFile, undefined, undefined, options), (promiseChain, fn) => {
    return promiseChain.then(fn);
  }, Promise.resolve()).then((payload) => {
    fs.writeFileSync(outputFile, JSON.stringify(payload, null, 2));
  }).then(() => console.log(`Successfully translated, file output at ${outputFile}`));
});
