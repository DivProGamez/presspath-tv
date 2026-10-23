/* PressPath TV — flashcard decks. Original, simple educational content for families. */
(function (root, factory) {
  var mod = factory();
  if (typeof module === 'object' && module.exports) module.exports = mod;
  else (root.PP = root.PP || {}).decks = mod;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var LETTERS = [
    ['A', 'Apple', '🍎'], ['B', 'Ball', '⚽'], ['C', 'Cat', '🐱'], ['D', 'Duck', '🦆'], ['E', 'Egg', '🥚'],
    ['F', 'Fish', '🐟'], ['G', 'Grapes', '🍇'], ['H', 'House', '🏠'], ['I', 'Ice cream', '🍦'], ['J', 'Juice', '🧃']
  ].map(function (x) {
    return {
      kind: 'letter', glyph: x[0],
      q: 'Which word starts with the letter ' + x[0] + '?',
      hint: 'Say the letter out loud, then think of a word.',
      a: x[0] + ' is for ' + x[1], emoji: x[2],
      more: 'Say it together: "' + x[0] + '… ' + x[1].toLowerCase() + '!"'
    };
  });

  var WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
  var NUMBERS = [3, 5, 2, 7, 4, 8, 1, 6, 9, 10].map(function (n) {
    return {
      kind: 'count', count: n,
      q: 'How many stars can you count?',
      hint: 'Point at each star as you count.',
      a: n + ' — ' + WORDS[n],
      more: n === 1 ? 'Just one star.' : 'Count again: ' + Array.from({ length: n }, function (_, i) { return i + 1; }).join(', ') + '.'
    };
  });

  var SCIENCE = [
    ['plant', 'What do plants need to make their own food?', 'Sunlight, water and air', 'Leaves use light to turn water and carbon dioxide into sugar.'],
    ['ice', 'What does water turn into when it freezes?', 'Ice', 'Pure water freezes at 0 °C (32 °F).'],
    ['earth', 'Which planet do we live on?', 'Earth', 'Earth is the third planet from the Sun.'],
    ['rainbow', 'What makes a rainbow appear?', 'Sunlight passing through raindrops', 'Each drop bends the light and splits it into colours.'],
    ['moon', 'Why can we see the Moon at night?', 'It reflects light from the Sun', 'The Moon does not make its own light.'],
    ['magnet', 'What kind of things does a magnet pull?', 'Things made of iron, like paper clips', 'Wood, plastic and paper are not attracted.'],
    ['heart', 'Which organ pumps blood around your body?', 'Your heart', 'It beats about 100,000 times every day.'],
    ['air', 'Which gas do we need to breathe in to live?', 'Oxygen', 'Plants release oxygen into the air.'],
    ['bee', 'What do bees make from flower nectar?', 'Honey', 'Bees also carry pollen that helps flowers make seeds.'],
    ['steam', 'What happens when water is heated to 100 °C?', 'It boils and turns into steam', 'Steam is water as a gas.']
  ].map(function (x) { return { kind: 'science', icon: x[0], q: x[1], hint: 'Think about it, then reveal.', a: x[2], more: x[3] }; });

  var DECKS = [
    { id: 'letters', title: 'Letters', sub: 'A to J · first words', cards: LETTERS, art: 'letters' },
    { id: 'numbers', title: 'Numbers', sub: 'Count from 1 to 10', cards: NUMBERS, art: 'numbers' },
    { id: 'science', title: 'Everyday Science', sub: 'Nature, space and you', cards: SCIENCE, art: 'science' }
  ];

  function get(id) { return DECKS.filter(function (d) { return d.id === id; })[0] || null; }

  return { DECKS: DECKS, get: get };
});
