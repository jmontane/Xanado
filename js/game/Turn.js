/*Copyright (C) 2019-2022 The Xanado Project https://github.com/cdot/Xanado
  License MIT. See README.md at the root of this distribution for full copyright
  and license information. Author Crawford Currie http://c-dot.co.uk*/
/* eslint-env amd */

define([
  "game/Tile", "game/Move", "common/Types"
], (Tile, Move, Types) => {

  const Penalty = Types.Penalty;

  /**
   * Despite the name, a Turn is used not just for a player's turn
   * (such as a play or a swap) but also for other results from
   * commands sent to the server, such as challenges.
   * @extends Move
   */
  class Turn extends Move {
    /**
     * The 'type' of the turn.
     * @member {Turns}
     */
    type;

    /**
     * Key of the game
     * @member {Key}
     */
    gameKey;

    /**
     * Key of the player who has been affected by the turn. Normally
     * this is the player who made the Move that resulted in the Turn,
     * but in the case of a challenge it is the player who was
     * challenged.
     * @member {Key}
     */
    playerKey;

    /**
     * Key of the next player who's turn it is
     * @member {Key}
     */
    nextToGoKey;

    /**
     * Time the turn was finished, assigned by the server.
     * @member {number}
     */
    timestamp;

    /**
     * @param {Game} game the game this is a turn in.
     * @param {object} params parameters. Any field with the same name
     * as a member (or a member of {@linkcode Move}) will initialise
     * that member.
     */
    constructor(game, params) {
      super(params);

      this.gameKey = game.key;
      this.type = params.type;
      this.playerKey = params.playerKey;
      this.nextToGoKey = params.nextToGoKey;
      this.timestamp = params.timestamp;

      if (params.replacements)
        /**
         * List of tiles drawn from the bag to replace the tiles played
         * in this turn. These tiles will not have positions.
         * @member {Tile[]?}
         */
        this.replacements = params.replacements.map(
          tilespec => new Tile(tilespec));

      if (params.challengerKey)
        /**
         * For `Turns.CHALLENGE_WON` and `Turns.CHALLENGE_LOST`,
         * the key of the player who challenged. playerkey in this case
         * will be the player who's play was challenged (always the
         * previous player)
         * @member {Key?}
         */
        this.challengerKey = params.challengerKey;

      if (params.endState)
        /**
         * String describing the reason the game ended. Only used when
         * type==Turns.GAME_ENDED
         * @member {State?}
         */
        this.endState = params.endState;

      if (params.passes && params.passes > 0)
        /**
         * Number of passes the player had before this play. Required
         * for undo.
         * @member {number?}
         */
        this.passes = params.passes;
    }

    /* istanbul ignore next */
    /**
     * String representation for debugging
     */
    stringify() {
      let s = `Turn ${this.type} ${this.playerKey}`;
      if (this.challengerKey)
        s += ` by ${this.challengerKey}`;
      if (this.nextToGoKey && this.nextToGoKey !== this.playerKey)
        s += ` ->${this.nextToGoKey}`;

      if (typeof this.score === "object")
        s += ` (${this.score.tiles||0},${this.score.time||0})`;
      else if (typeof this.score === "number")
          s += ` (${this.score})`;

      if (this.placements)
        s += " <=" + this.placements.map(t => t.stringify(true));

      if (this.words)
        s += ' "' + this.words.map(w => w.word) + '"';

      if (this.replacements)
        s += " => " + this.replacements.map(t => t.stringify(true));

      if (this.penalty === Penalty.MISS)
        s += ` MISS`;

      if (this.endState)
        s += ` ${this.endState}`;

      return s;
    }
  }

  return Turn;
});
