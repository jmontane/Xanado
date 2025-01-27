/*Copyright (C) 2019-2022 The Xanado Project https://github.com/cdot/Xanado
  License MIT. See README.md at the root of this distribution for full copyright
  and license information. Author Crawford Currie http://c-dot.co.uk*/
/* eslint-env browser, jquery */

/**
 * Browser app for games.html; populate the list of live games
 */
requirejs([
  "platform", "common/Utils",
  "browser/UI", "browser/Dialog",
  "common/Types", "game/Player", "game/Game",
  "jquery"
], (
  Platform, Utils,
  UI, Dialog,
  Types, Player, Game
) => {

  const TWIST_OPEN = "\u25BC";
  const TWIST_CLOSE = "\u25B2";

  const Notify    = Types.Notify;
  const Penalty   = Types.Penalty;
  const State     = Types.State;
  const Timer     = Types.Timer;
  const WordCheck = Types.WordCheck;

  /**
   * Management interface for a database of games.
   * @extends UI
   */
  class GamesUI extends UI {

    constructor() {

      super();

      /**
       * Map of game keys to boolean, true if the game is untwisted (open)
       * @member {object}
       */
      this.isUntwisted = {};

      const untwist = location.search.replace(/^.*[?&;]untwist=([^&;]*).*$/,"$1");
      if (untwist && untwist !== "undefined")
        this.isUntwisted[untwist] = true;
    }

    // @override
    attachHandlers() {
      $("#showAllGames")
      .on("change", () => this.refresh_games());

      $("#reminder-button")
      .on("click", () => {
        console.log("Send reminders");
        $.post("/sendReminder/*")
        .then(info => $("#alertDialog")
              .text($.i18n.apply(null, info))
              .dialog({
                title: $.i18n("Email turn reminders"),
                modal: true
              }))
        .catch(UI.report);
      });

      $("#create-game")
      .on("click", () => Dialog.open("CreateGameDialog", {
        ui: this,
        postAction: "/createGame",
        postResult: () => this.refresh_games(),
        error: UI.report
      }));

      $("#login-button")
      .on("click", () => Dialog.open("LoginDialog", {
        // postAction is dynamic, depends which tab is open
        postResult: () => this.refresh().catch(UI.report),
        error: UI.report
      }));

      $("#logout-button")
      .on("click", () => {
        $.post("/logout")
        .then(result => {
          console.log("Logged out", result);
          this.session = undefined;
          this.refresh().catch(UI.report);
        })
        .catch(UI.report);
      });

      $("#chpw_button")
      .on("click", () => Dialog.open("ChangePasswordDialog", {
        postAction: "/change-password",
        postResult: () => this.refresh().catch(UI.report),
        error: UI.report
      }));

      super.attachHandlers();
    }

    // @override
    readyToListen() {
      return this.refresh();
    }

    // @override
    attachSocketListeners() {
      super.attachSocketListeners();

      this.socket
      .on(Notify.UPDATE, () => {
        console.debug("--> update");
        // Can be smarter than this!
        this.refresh().catch(UI.report);
      });

      // Tell the server we want to receive monitor messages
      this.socket.emit(Notify.MONITOR);
    }

    /**
     * Construct a table row that shows the state of the given player
     * @param {Game|object} game a Game or Game.simple
     * @param {Player} player the player
     * @param {boolean} isActive true if the game isn't over
     */
    $player(game, player, isActive) {
      Platform.assert(player instanceof Player);
      const $tr = player.$tableRow();

      if (isActive) {
        if (player.dictionary && player.dictionary !== game.dictionary) {
          const dic = $.i18n("using dictionary $1", player.dictionary);
          $tr.append(`<td>${dic}</td>`);
        }

        if (game.timerType && player.clock) {
          const left = $.i18n("$1s left to play", player.clock);
          $tr.append(`<td>${left}</td>`);
        }

      } else {
        const winningScore = game.getPlayers().reduce(
          (max, p) =>
          Math.max(max, p.score), 0);

        if (player.score === winningScore) {
          $tr.append('<td class="ui-icon icon-winner"></td>');
        }

        return $tr;
      }

      if (!this.session)
        return $tr;

      const $box = $("<td></td>");
      $tr.append($box);

      if (player.key === this.session.key) {
        // Currently signed in player
        $box.append(
          $("<button name='join' title=''></button>")
          .button({ label: $.i18n("Open game") })
          .tooltip({
            content: $.i18n("Open this game in a new window.")
          }) .on("click", () => {
            console.log(`Join game ${game.key}/${this.session.key}`);
            $.post(`/join/${game.key}`)
            .then(() => {
              window.open(
                `/html/game.html?game=${game.key}&player=${this.session.key}`,
                "_blank");
              this.refresh_game(game.key);
            })
            .catch(UI.report);
          }));

        $box.append(
          $("<button name='leave' title='' class='risky'></button>")
          .button({ label: $.i18n("Leave game") })
          .tooltip({
            content: $.i18n("If you leave the game your score will still count towards the leader board.")
          })
          .on("click", () => {
            console.log(`Leave game ${game.key}`);
            $.post(`/leave/${game.key}`)
            .then(() => this.refresh_game(game.key))
            .catch(UI.report);
          }));

        return $tr;
      }
      else if (player.isRobot) {
        $box.append(
          $("<button name='removeRobot' title=''></button>")
          .button({ label: $.i18n("Remove robot") })
          .tooltip({
            content: $.i18n("Remove the robot from this game.")
          })
          .on("click", () => {
            console.log(`Remove robot from ${game.key}`);
            $.post(`/removeRobot/${game.key}`)
            .then(() => this.refresh_game(game.key))
            .catch(UI.report);
          }));

      }

      // Not the signed in player
      if (this.getSetting("canEmail")
          && !player.isRobot
          && game.whosTurnKey === player.key) {
        $box.append(
          $("<button name='email' title=''></button>")
          .button({ label: $.i18n("Send reminder") })
          .tooltip({
            content: $.i18n("Email a reminder to player whose turn it is.")
          })
          .on("click", () => {
            console.log("Send reminder");
            $.post(`/sendReminder/${game.key}`)
            .then(names => $("#alertDialog")
                  .text($.i18n(/*i18n*/"Reminded $1", names.join(", ")))
                  .dialog({
                    title: $.i18n("Reminded $1", player.name),
                    modal: true
                  }))
            .catch(UI.report);
          }));
      }

      return $tr;
    }

    /**
     * Headline is the text shown when a game twisty is closed
     */
    $headline(game) {
      const headline = [ game.edition ];

      if (game.getPlayers().length > 0)
        headline.push($.i18n(
          "players $1",
          Utils.andList(game.getPlayers().map(p => p.name))));
      headline.push($.i18n(
        "created $1",
        new Date(game.creationTimestamp).toDateString()));

      const isActive = (game.state === State.PLAYING
                        || game.state === State.WAITING);

      const $h = $("<span></span>")
      .addClass("headline")
      .text(headline.join(", "));

      if (!isActive)
        $h.append(
          $("<span></span>")
          .addClass("game-state")
          .text($.i18n(game.state)))
        .append(
          $("<span></span>")
          .addClass("who-won")
          .text($.i18n(" $1 won", game.getWinner().name)));
      return $h;
    }

    /**
     * Construct a table that shows the state of the given game
     * @param {Game|object} game a Game or Game.simple
     */
    $game(game) {
      Platform.assert(game instanceof Game);
      const $box = $(`<div class="game" id="${game.key}"></div>`);
      const $twist = $("<div class='twist'></div>");
      const $twistButton =
            $("<button name='twist'></button>")
            .button({ label: TWIST_OPEN })
            .addClass("no-padding")
            .on("click", () => showHideTwist(!$twist.is(":visible")));

      const showHideTwist = show => {
        if (show) {
          $twist.show();
          $twistButton.button("option", "label", TWIST_CLOSE);
          this.isUntwisted[game.key] = true;
        } else {
          $twist.hide();
          $twistButton.button("option", "label", TWIST_OPEN);
          this.isUntwisted[game.key] = false;
        }
      };

      showHideTwist(this.isUntwisted && this.isUntwisted[game.key]);

      $box
      .append($('<div></div>')
              .addClass("game-key")
              .text(game.key))
      .append($twistButton)
      .append(this.$headline(game))
      .append($twist);

      const options = [];
      if (game.dictionary)
        options.push($.i18n("Dictionary $1", game.dictionary));
      if (game.timerType === Timer.TURN)
        options.push($.i18n("Turn time limit $1",
                            Utils.formatTimeInterval(game.timeLimit)));
      else if (game.timerType === Timer.GAME) {
        options.push($.i18n("Game time limit $1",
                            Utils.formatTimeInterval(game.timeLimit)));
        options.push($.i18n("Overtime penalty $1 point{{PLURAL:$1||s}} per minute",
                            game.timePenalty));
      }
      if (game.predictScore)
        options.push($.i18n("Predict score"));
      if (game.wordCheck)
        options.push($.i18n(game.wordCheck));
      if (game.allowTakeBack)
        options.push($.i18n("Allow 'Take back'"));
      if (game.minPlayers && game.maxPlayers === game.minPlayers)
        options.push($.i18n("$1 players", game.minPlayers));
      else if (game.maxPlayers > game.minPlayers)
        options.push($.i18n("$1 to $2 players",
                            game.minPlayers, game.maxPlayers));
      else if (game.minPlayers > 2)
        options.push($.i18n("At least $1 players", game.minPlayers));

      switch (game.challengePenalty) {
      case Penalty.PER_TURN:
        options.push($.i18n("Lose $1 points for a failed challenge",
                            game.penaltyPoints));
        break;
      case Penalty.PER_WORD:
        options.push($.i18n(
          "Lose $1 points for each wrongly challenged word",
          game.penaltyPoints));
        break;
      case Penalty.MISS:
        options.push($.i18n("Miss a turn after a failed challenge"));
        break;
      }

      if (options.length > 0) {
        $twist.append(
          $(`<div class="game-options"></div>`)
          .text($.i18n("Options: " + options.join(", "))));
      }

      const isActive = (game.state === State.PLAYING
                        || game.state === State.WAITING);

      const $table = $("<table></table>").addClass("player-table");
      $twist.append($table);
      game.getPlayers().forEach(
        player => $table.append(this.$player(game, player, isActive)));

      if (isActive)
        // .find because it's not in the document yet
        $table.find(`#player${game.whosTurnKey}`).addClass("whosTurn");

      if (isActive
          && this.session
          && ((game.maxPlayers || 0) === 0
              || game.getPlayers().length < game.maxPlayers)) {

        if (!game.getPlayerWithKey(this.session.key)) {
          // Can join game
          const $join = $(`<button name="join" title=''></button>`);
          $twist.append($join);
          $join
          .button({ label: $.i18n("Join game") })
          .tooltip({
            content: $.i18n("Join the game and open it in a new window.")
          })
          .on("click", () => {
            console.log(`Join game ${game.key}`);
            $.post(`/join/${game.key}`)
            .then(info => {
              window.open(`/html/game.html?game=${game.key}&player=${this.session.key}`, "_blank");
              this.refresh_game(game.key);
            })
            .catch(UI.report);
          });
        }

        if (!game.getPlayers().find(p => p.isRobot)) {
          $twist.append(
            $(`<button name='robot' title=''></button>`)
            .button({ label: $.i18n("Add robot") })
            .tooltip({
              content: $.i18n("Add a robot player to this game.")
            })
            .on("click", () =>
                Dialog.open("AddRobotDialog", {
                  ui: this,
                  postAction: `/addRobot/${game.key}`,
                  postResult: () => this.refresh_game(game.key),
                  error: UI.report
                })));
        }
      }

      if (this.session) {
        if (isActive && this.getSetting("canEmail")) {
          $twist.append(
            $("<button name='invite' title=''></button>")
            .button({ label: $.i18n("Invite players")})
            .tooltip({
              content: $.i18n("Send emails to invite people to join the game.")
            })
            .on("click", () => Dialog.open("InvitePlayersDialog", {
              postAction: `/invitePlayers/${game.key}`,
              postResult: names => {
                $("#alertDialog")
                .text($.i18n("Invited $1", names.join(", ")))
                .dialog({
                  title: $.i18n("Invitations"),
                  modal: true
                });
              },
              error: UI.report
            })));
        }

        if (!(isActive || game.nextGameKey)) {
          $twist.append(
            $("<button name='another' title=''></button>")
            .button({ label: $.i18n("Another game like this") })
            .on("click",
                () => $.post(`/anotherGame/${game.key}`)
                .then(() => this.refresh_games())
                .catch(UI.report)));
        }

        $twist.append(
          $("<button name='delete' title='' class='risky'></button>")
          .tooltip({
            content: $.i18n("CAREFUL! This cannot be undone!")
          })
          .button({ label: $.i18n("Delete") })
          .on("click", () => $.post(`/deleteGame/${game.key}`)
              .then(() => this.refresh_games())
              .catch(UI.report)));

        return $box;
      }

      // Nobody logged in, offer to observe
      const obs = $.i18n("Observe game");
      $twist.append(
        $("<button name='observe' title=''></button>")
        .button({ label: obs })
        .tooltip({
          content: $.i18n("Open a board to watch the game, but not play.")
        })
        .on("click", () => $("#observeDialog")
            .dialog({
              create: function () {
                $(this).find("button[type=submit]")
                .on("click", () => {
                  $(this).dialog("close");
                });
              },
              title: obs,
              closeText: obs,
              modal: true,
              close: function() {
                const name = encodeURIComponent(
                  $(this).find("#observerName").val());
                console.log("Observe game", game.key,
                            "as", name);
                window.open(
                  `/html/game.html?game=${game.key};observer=${name}`,
                  "_blank");
                this.refresh_game(game.key);
              }
            })));

      return $box;
    }

    /**
     * Refresh the display of a single game
     * @param {Game|object} game a Game or Game.simple
     */
    show_game(game) {
      console.log(`Reshow ${game.key}`);
      $(`#${game.key}`).replaceWith(this.$game(game));
    }

    /**
     * Refresh the display of all games
     * @param {object[]} games array of Game.simple
     */
    show_games(simples) {
      if (simples.length === 0) {
        $("#gamesList").hide();
        return;
      }

      const $gt = $("#gamesTable");
      $gt.empty();

      const games = simples.map(simple => Game.fromSimple(simple));

      games.forEach(game => $gt.append(this.$game(game)));

      $("#gamesList").show();
      $("#reminder-button").hide();
      if (this.session && this.getSetting("canEmail")) {
        if (games.reduce((em, game) => {
          // game is Game.simple, not a Game object
          // Can't remind a game that hasn't started or has ended.
          if (game.state !== State.PLAYING)
            return em;
          return em || game.getPlayerWithKey(game.whosTurnKey)
          .email;
        }, false))
          $("#reminder-button").show();
      }
    }

    /**
     * Request an update for a single game (which must exist in the
     * games table)
     * @param {string} key Game key
     */
    refresh_game(key) {
      return $.get(`/simple/${key}`)
      .then(simple => this.show_game(Game.fromSimple(simple[0])))
      .catch(UI.report);
    }

    /**
     * Request an update for all games
     */
    refresh_games() {
      console.debug("refresh_games");
      const what = $("#showAllGames").is(":checked") ? "all" : "active";
      return $.get(`/simple/${what}`)
      .then(games => this.show_games(games))
      .catch(UI.report);
    }

    /**
     * Request an update for session status and all games lists
     * @return {Promise} promise that resolves when all AJAX calls have completed
     */
    refresh() {
      console.debug("refresh");
      return Promise.all([
        this.getSession()
        .then(session => {
          if (session) {
            $("#create-game").show();
            $("#chpw_button").toggle(session.provider === "xanado");
          } else {
            $("#create-game").hide();
          }
        })
        .then(() => this.refresh_games()),

        $.get("/history")
        .then(data => {
          if (data.length === 0) {
            $("#gamesCumulative").hide();
            return;
          }
          let n = 1;
          $("#gamesCumulative").show();
          const $gt = $("#player-list");
          $gt.empty();
          data.forEach(player => {
            const s = $.i18n(
              "$1: <b>$2</b>: $3 ($5 win{{PLURAL:$5||s}} from $4 game{{PLURAL:$4||s}})", n++, player.name, player.score,
              player.games, player.wins);
            $gt.append(`<div class="player-cumulative">${s}</div>`);
          });
        })
      ]);
    }
  }

  new GamesUI().create();
});
