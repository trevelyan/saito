var saito = require('../../../saito');
var ModTemplate = require('../../template');
var util = require('util');


//////////////////
// CONSTRUCTOR  //
//////////////////
function Tweeter(app) {

  if (!(this instanceof Tweeter)) { return new Tweeter(app); }

  Tweeter.super_.call(this);

  this.app             = app;

  this.name            = "Tweeter";

  this.tweets          = [];

  return this;

}
module.exports = Tweeter;
util.inherits(Tweeter, ModTemplate);


////////////////
// Initialize //
////////////////
Tweeter.prototype.initialize = function initialize() {

  tweets.push({
    quote: "Oh, how many ideas and works had perished in that building —a whole lost culture? Oh, soot, soot, from the Lubyanka chimneys! And the most hurtful thing of all was that our descendants would consider our generation more stupid, less gifted, less vocal than in actual fact it was.",
    author: "Alexander Solzhenitsyn"
  });
  tweets.push({
    quote: "We all only live once. So we are obligated to make good use of the time that we have and to do something that is meaningful and satisfying. This is something that I find meaningful and satisfying. That is my temperament. I enjoy creating systems on a grand scale, and I enjoy helping people who are vulnerable. And I enjoy crushing bastards.",
    author: "Julian Assange"
  });
  tweets.push({
    quote: "A bit of advice given to a young Native American at the time of his initiation: as you go the way of life, you will see a great chasm. Jump. It is not as wide as you think.",
    author: "Joseph Campbell"
  });
  tweets.push({
    quote: "I knew how severe I had been and how bad things had been. The one who is doing his work and getting satisfaction from it is not the one that poverty bothers. I thought of bathtubs and showers and toilets that flushed as things that inferior people to us had or that you enjoyed when you made trips, which we often made. There was always the public bathhouse down at the foot of the street by the river. My wife had never complained once about these things any more than she cried about Chevre d'Or when he fell. She had cried for the horse, I remembered, but not for the money. I had been stupid when she needed a grey lamb jacket and had loved it once she had bought it. I had been stupid about other things too. It was all part of the fight against poverty that you never win except by not spending. Especially if you buy pictures instead of clothes. But then we did not ever think of ourselves as poor. We did not accept it. We thought we were superior people and other people that we looked down on and rightly mistrusted were rich. It had never seemed strange to me to wear sweatshirts for underwear to keep warm. It only seemed odd to the rich. We ate well and cheaply and drank well and cheaply and slept well and warm together and loved each other.",
    author: "Ernest Hemingway"
  });
  tweets.push({
    quote: "Thus inflation is unjust and deflation is inexpedient. Of the two perhaps deflation is, if we rule out exaggerated inflations such as that of Germany, the worse; because it is worse, in an impoverished world, to provoke unemployment than to disappoint the rentier. But it is necessary that we should weigh one evil against the other. It is easier to agree that both are evils to be shunned.",
    author: "John Maynard Keynes"
  });
  tweets.push({
    quote: "Until then I had thought each book spoke of the things, human or divine, that lie outside books. Now I realized that not infrequently books speak of books: it is as if they spoke among themselves. In the light of this reflection, the library seemed all the more disturbing to me. It was then the place of a long, centuries-old murmuring, an imperceptible dialogue between one parchment and another, a living thing, a receptacle of powers not to be ruled by a human mind, a treasure of secrets emanated by many minds, surviving the death of those who had produced them or had been their conveyors.",
    author: "Umberto Eco"
  });
  tweets.push({
    quote: "It’s more fun to be a pirate than to join the navy.",
    author: "Steve Jobs"
  });
  tweets.push({
    quote: "Life is suffering, and suffering can make you resentful, murderous, and then genocidal if you take it far enough. So you need an antidote to suffering. And maybe you think that you can build walls of luxury around yourself, and that that will protect you from the suffering. Good luck with that. That isn't going to work. Maybe you think that you could build a delusion and live inside that. Well, that's going to fall apart. What is there, then, that's going to help you fight against suffering? That's easy: It's the Truth. The Truth is the antidote to suffering. The reason for that is because the Truth puts reality behind you, so that you can face the reality that's coming straight at you without becoming weak and degenerating and becoming resentful, and wishing for the destruction of Being, because that's the final Hell. The final Hell is your soul wishing for the destruction of everything, because it's too painful, and you're too bitter. And that happens to people all the time.",
    author: "Jordan Peterson"
  });
  tweets.push({
    quote: "The power of spurious realities battering at us today—these deliberately manufactured fakes never penetrate to the heart of true human beings. I watch the children watching TV and at first I am afraid of what they are being taught, and then I realize, They can't be corrupted or destroyed. They watch, they listen, they understand, and, then, where and when it is necessary, they reject.",
    author: "Philip K. Dick"
  });
  tweets.push({
    quote: "Oh, life is a glorious cycle of song <br />A medley of extemporanea <br />And love is a thing that can never go wrong, <br/>And I am Marie of Roumania.",
    author: "Dorothy Parker"
  });
  tweets.push({
    quote: "Are you co-conspirators in the current follow of nations, who want above all to produce as much as possible and to be as rich as possible? But where is your inner worth when you no longer know what it means to breathe freely? when you no longer have the slightest control over yourselves? when you listen to the newspapers and leer at your rich neighbour, made lustful by the rapid rise and fall of power, money and opinions?",
    author: "Nietzsche (The Dawn)"
  });
  tweets.push({
    quote: "Wing Chao didn't know he'd been handpicked by Greg Lippman to persuade Steve Eisman that the people on the other end of his credit default swaps were either crooks or morons, but he played the role anyway. Between shots of sake he told Eisman that he would rather have $50 billion in crappy CDOs than none at all, as he was paid mainly on volume.... When the meal was over Eisman grabbed Lippman, pointed to Wing Chao and said \"whatever that guy is buying, I want to short it.\" Lippmann took it as a joke, but Eisman was completely serious. He wanted to place a bet specifically against Wing Chao. \"Greg,\" Eisman said, \"I want to short his paper. Sight unseen.\"",
    author: "Michael Lewis (The Big Short)"
  });



}


