/*Copyright (C) 2019-2022 The Xanado Project https://github.com/cdot/Xanado
  License MIT. See README.md at the root of this distribution for full copyright
  and license information. Author Crawford Currie http://c-dot.co.uk*/
/* eslint-env node */

/**
 * Command-line program to explore the words encoded in a DAWG
 * generated by {@link module:js/dawg/Compressor}
 * `node js/dawg/explore.js` will tell you how to use it
 * @module explore
 */
const requirejs = require("requirejs");

requirejs.config({
  baseUrl: `${__dirname}/../..`,
  paths: {
    common: "js/common",
    server: "js/server",
    platform: "js/server/Platform",
    dawg: "js/dawg",
    game: "js/game"
  }
});

requirejs([
  "fs", "node-getopt", "path",
  "dawg/Dictionary", "dawg/Explorer"
], (
  fs, Getopt, Path,
  Dictionary, Explorer
) => {
  const Fs = fs.promises;
  const DESCRIPTION =
        "USAGE\n node explore.js [options] <dictionary> <action> [<words>]"
        + "\nExplore a DAWG dictionary, <dictionary> is a file path to a"
        + "\n.dict file."
        + "\ne.g. `node explore.js dictionaries/CSW2019_English.dict list`"
        + "\nThe following actions are available:"
        + "\n\nanagrams"
        + "\n\tFind anagrams of the words that use all the letters."
        + "\n\narrangements"
        + "\n\tFind anagrams of the letters of the words, including"
        + "\n\tsub-sequences of the letters e.g. `LED` is a sequence"
        + "\n\tof the letters in `WELD`, `WHEELED` and `FLED`"
        + "\n\nsequences"
        + "\n\tDetermine if the strings passed are valid sub-sequences of"
        + "\n\tany word in the dictionary e.g. 'UZZL' is a valid sub-sequence"
        + "\n\tas it is found in 'PUZZLE'. However 'UZZZL' isn't."
        + "\n\nlist"
        + "\n\tList words in the dictionary. If `words` are given, lists all"
        + "\n\tdictionary entries that start with one of the words."
        + "\n\nThe default action is `list`."
        + "\nAction names are not case-sensitive.";
  const OPTIONS = [
    ["h", "help", "Show this help"],
    ["f", "file=ARG", "Include words read from file"],
  ];

  const getopt = Getopt.create(OPTIONS)
        .bindHelp()
        .setHelp(`${DESCRIPTION}\nOPTIONS\n[[OPTIONS]]`)
        .parseSystem();
  const options = getopt.options;

  const dawg = getopt.argv.shift();
  let action = getopt.argv.shift();
  if (action) action = action.toLowerCase();  else action ="list";
  const words = getopt.argv;

  if (!dawg) {
    getopt.showHelp();
    return;
  }
  let getWords;
  if (options.file) {
    getWords = Fs.readFile(this.options.file)
    .then(data => data.toString().split(/\s+/).map(w => words.push(w)));
  } else
    getWords = Promise.resolve(words);

  getWords
  .then(words => words.map(w => w.toUpperCase()))
  .then(words => {
    let dir  = Path.dirname(dawg);
    if (dir === ".") dir = undefined;
    const dict = Path.basename(dawg, ".dict");
    console.log(dict, action, words);
    return Dictionary.load(dict, dir)
    .then(dictionary =>
          Explorer[action].call(null, dictionary, words, console.log));
  });
});
