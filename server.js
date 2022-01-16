/*
        SERVER SETUP
*/
var express = require('express');
var app = express();
var server = require('http').createServer(app);
var io = require('socket.io')(server);

app.use(express.static(__dirname + '/node_modules'));
app.use('/src',express.static(__dirname + '/public'));
app.get('/',function(req,res){
  res.sendFile(__dirname + '/public/index.html');
});

/*
        CONNECTION HANDLER
*/

let clientMap = new Map();

io.on('connection', function(client) {
    clientJoinEvent(client);
    clientLeaveEvent(client);
    clientPlayEvent(client);
    clientResetEvent(client);
});

server.listen(3000);
console.log("Listening at port 3000");

/*
        CLIENT EVENTS
*/

function clientJoinEvent(client){
    client.on('join', function(playerData){
        clientMap.set(client.id,client);
        playerData.clientID = client.id;
        let idx = addPlayer(playerData);
        gameData.players[idx].index = idx;
        gameData.players[idx].clientID = client.id;
        if (fullLobby() && gameData.state == 0)
            gameData.lastGameLog = 'Press PLAY to start';
        sendPlayerData();
        sendGameData();
    })
}

function clientLeaveEvent(client) {
    client.once('disconnect', function() {      
    });
}

function clientPlayEvent(client) {
    client.on('play', function(playerData){
        play(playerData);
    });
}

function clientResetEvent(client) {
    client.on('reset', function(){
        resetGame();
    })
}

function player2client(player) {
    return clientMap.get(player.clientID);
}

/*
        GAME MECHANICS
*/

// Game States
let PREGAME = 0;
let DEAL = 1;
let BID = 2;
let PICKSUIT = 3;
let DEAL2 = 4;
let TRICK = 5;
let FINAL = 6;

// Team Indices
let RED_TEAM_INDICES = [0,2];
let BLUE_TEAM_INDICES = [1,3];

// Game Info
const gameData = {
    players: [
        {
            displayName: 'Empty',
            team: -1,
        },
        {
            displayName: 'Empty',
            team: -1,
        },
        {
            displayName: 'Empty',
            team: -1,
        },
        {
            displayName: 'Empty',
            team: -1,
        }
    ],
    state: PREGAME,
    lastGameLog: "Waiting for players...",
    deck: {
        cards: [],
        next: 0
    },
    pile: [],
    redTeam: {
        score: 0,
        stash: []
    },
    blueTeam: {
        score: 0,
        stash: []
    },
    dealer: -1,
    leader: -1,
    bidder: -1,
    bid: -1,
    turn: -1,
    trump: -1,
    winner: -1
}

function resetGame() {
    gameData.state = PREGAME;
    gameData.lastGameLog = 'Game reset.';
    gameData.deck.cards = [];
    gameData.deck.next = 0;
    gameData.pile = [];
    gameData.redTeam.score = 0;
    gameData.redTeam.stash = [];
    gameData.blueTeam.score = 0;
    gameData.blueTeam.stash = [];
    gameData.dealer = -1;
    gameData.leader = -1;
    gameData.bidder = -1;
    gameData.bid = -1;
    gameData.turn = -1;
    gameData.trump = -1;
    gameData.winner = -1;
    clearHands();
    clearPlayCards();
    sendPlayerData();
    sendGameData();
}

function teamIndices(team) {
    let indices = [];
    if (!team) {
        indices = RED_TEAM_INDICES;
        RED_TEAM_INDICES = RED_TEAM_INDICES.reverse();
    } else {
        indices = BLUE_TEAM_INDICES;
        BLUE_TEAM_INDICES = BLUE_TEAM_INDICES.reverse();
    }
    return indices;
}

function setPlayer(idx, player) {
    gameData.players[idx].displayName = player.displayName;
    gameData.players[idx].team = player.team;
    return idx;
}

function kickPlayer(player) {
    let client = player2client(player);
    client.emit('kick');
}

function addPlayer(player) {
    let teamIdcs = teamIndices(player.team);
    for (let i = 0; i < 4; i++)
        if (teamIdcs.includes(i))
            if (gameData.players[i].displayName == 'Empty')
                return setPlayer(i,player);
    kickPlayer(gameData.players[teamIdcs[1]]);
    return setPlayer(teamIdcs[1], player);
}

function sendGameData(){
    io.emit('gamedata', gameData)
}

function sendPlayerData() {
    gameData.players.forEach(player => {
        if (player.displayName != 'Empty')
            player2client(player).emit('playerdata', player);
    })
}

function fullLobby() {
    return gameData.players.filter(player => player.displayName == 'Empty').length == 0;
}

function sendServerMessage(player, message, color) {
    let client = player2client(player);
    if (client != undefined)
        client.emit('servermsg',message,color);
}

function generateNewDeck() {
    gameData.deck.cards = Array(53).fill().map((x,i)=>i);
    gameData.deck.cards = gameData.deck.cards.sort((a,b) => 0.5 - Math.random());
    gameData.deck.next = 0;
}

function nextCardFromDeck() {
    return gameData.deck.cards[gameData.deck.next++];
}

function nextPlayer() {
    gameData.turn = (gameData.turn+1)%4;
    return gameData.players[gameData.turn];
}

function randomDealer() {
    gameData.dealer = Math.floor(Math.random() * 4);
    return gameData.players[gameData.dealer];
}

function start() {
    let dealer = randomDealer();
    gameData.lastGameLog = "The randomly chosen dealer is " + dealer.displayName;
    gameData.state = DEAL;
    sendGameData();
}

function clearHands() {
    gameData.players.forEach(player => {
        player.hand = [];
    });
}

function clearPlayCards() {
    gameData.players.forEach(player => {
        delete(player.current);
    });
}

function deal(player) {
    generateNewDeck();
    clearHands();
    clearPlayCards();
    gameData.turn = player.index;
    gameData.players.forEach(player => {
        for (let i = 0; i < 6; i++)
            player.hand[i] = nextCardFromDeck();
    });
    for (let i = 0; i < 6; i++)
        gameData.pile[i] = nextCardFromDeck();
    sendPlayerData();
    let turn = nextPlayer();
    gameData.lastGameLog = turn.displayName + " bids first.";
    gameData.state = BID;
    sendGameData();
}

function bid(player) {
    let pbid = player.selectedBid;
    if (pbid < 7) {
        if (pbid > gameData.bid) {
            gameData.bid = pbid;
            gameData.bidder = player.index;
            gameData.lastGameLog = player.displayName + ' bids ' + pbid + ".  " + nextPlayer().displayName + "'s turn.";
        } else {
            sendServerMessage(player, 'Bid too low. Current bidder: ' + gameData.players[gameData.bidder].displayName + ' (' + gameData.bid + ')');
            return;
        }
    } else if (pbid == 7) {
        gameData.bid = 7;
        gameData.bidder = player.index;
        gameData.lastGameLog = player.displayName + ' bids 6 AND OUT!';
        gameData.players[gameData.bidder].hand = gameData.players[gameData.bidder].hand.concat(gameData.pile);
        gameData.state = PICKSUIT;
        sendPlayerData();
        sendGameData();
        return;
    } else if (pbid == 8) {
        if (gameData.bidder != -1) {
            gameData.lastGameLog = player.displayName + " passes.  " + nextPlayer().displayName + "'s turn.";
        } else {
            sendServerMessage(player, 'First bidder cannot pass.')
            return;
        }
    }
    if (gameData.turn == (gameData.dealer+1)%4) {
        gameData.players[gameData.bidder].hand = gameData.players[gameData.bidder].hand.concat(gameData.pile);
        let bidder = gameData.players[gameData.bidder];
        gameData.lastGameLog = bidder.displayName + " picks the suit.";
        gameData.state = PICKSUIT;
        sendPlayerData(); 
    }
    sendGameData();
}

function suit2str(suit) {
    switch(suit){
        case 0: return 'SPADES';
        case 1: return 'HEARTS';
        case 2: return 'CLUBS';
        case 3: return 'DIAMONDS';
        default: return 'NULL';
      }
}

function card2suit(card) {
    return Math.floor(card/13);
}

function offjack() {
    return ((gameData.trump+2)%4)*13 + 9;
}

function trimHandsToSuit(suit) {
    gameData.players.forEach(player => {
       player.hand = player.hand.filter(
           card => card == 52 
        || card2suit(card) == suit
        || card == offjack()
        ).splice(0,6)
    });
}

function trump(player) {
    gameData.trump = player.selectedSuit;
    gameData.lastGameLog = player.displayName + ' chooses ' + suit2str(player.selectedSuit) + ' as trump. ' 
        + gameData.players[gameData.dealer].displayName + "'s deal.";
    gameData.state = DEAL2;
    trimHandsToSuit(player.selectedSuit);
    sendPlayerData();
    sendGameData();
}

function deal2(player) {
    gameData.players.forEach(player => {
        for (let i = player.hand.length; i < 6; i++)
            player.hand[i] = nextCardFromDeck();
    });
    sendPlayerData();
    gameData.turn = gameData.bidder;
    gameData.leader = gameData.bidder;
    gameData.lastGameLog = gameData.players[gameData.bidder].displayName + ' leads.';
    gameData.state = TRICK;
    sendGameData();
}

function card2str(card) {
    if (card == 52)
      return 'JOKER';
    let suitstr = suit2str(card2suit(card));
    switch(card%13 + 2){
      case 11: return 'JACK OF ' + suitstr;
      case 12: return 'QUEEN OF ' + suitstr;
      case 13: return 'KING OF ' + suitstr;
      case 14: return 'ACE OF ' + suitstr;
      default: return (card%13 + 2) + ' OF ' + suitstr;
    }
}

function card2value(card) {
    if (card == 52)
        return 50;
    let leadsuit = card2suit(gameData.players[gameData.leader].current);
    let suit = card2suit(card);
    let value = card%13;
    if (suit == gameData.trump)
        value += 26;
    else if (card == offjack())
        value += 25.5
    else if (suit == leadsuit)
        value += 13;
    return value;
}

function bestPlayer(){
    let bestplayer = gameData.players[0];
    gameData.players.forEach(player => {
        if (card2value(player.current) > card2value(bestplayer.current))
            bestplayer = player;
    })
    return bestplayer;
}

function currentCards() {
    return Array(4).fill().map((x,i) => gameData.players[i].current);
}

function canPlay(player, card) {
    if (player.index == gameData.leader)
        return true;
    let suit = card2suit(card);
    let leadCard = gameData.players[gameData.leader].current
    let leadsuit = leadCard == 52 ? gameData.trump : card2suit(leadCard);
    if (card == 52 || suit == gameData.trump || card == offjack() || suit == leadsuit )
        return true;
    else if (leadsuit != gameData.trump && player.hand.filter(card => card2suit(card) == leadsuit && card != offjack()).length == 0)
        return true;
    else if (leadsuit == gameData.trump && player.hand.filter(card => card2suit(card) == leadsuit || card == offjack()).length == 0)
        return true;
    else
        return false;
}

function card2score(card) {
    if (card == 52) return 5;
    switch (card%13) {
        case 8: return 10;
        case 9: return 1;
        case 10: return 2;
        case 11: return 3;
        case 12: return 4;
    }
    return 0;
}

function countPoints() {
    let allCards = gameData.redTeam.stash.concat(gameData.blueTeam.stash);
    let trumpCards = allCards.filter(card => card2suit(card) == gameData.trump).sort((a,b) => a - b);
    let min = Math.min.apply(Math, trumpCards);
    let max = Math.max.apply(Math, trumpCards);
    let pointCards = [min, 13*gameData.trump + 9, offjack(), max, 52];
    let redTeamTally = 0;
    let blueTeamTally = 0;
    let points = [0,0];
    gameData.redTeam.stash.forEach(card => {
        redTeamTally += card2score(card);
        if (pointCards.includes(card))
            points[0] += 1;
    });
    gameData.blueTeam.stash.forEach(card => {
        blueTeamTally += card2score(card);
        if (pointCards.includes(card))
            points[1] += 1;
    });
    if (redTeamTally > blueTeamTally)
        points[0] += 1;
    else if (blueTeamTally > redTeamTally)
        points[1] += 1;
    else
        points[gameData.players[gameData.dealer].team] += 1;
    return points;
}

function tallyPoints() {
    let points = countPoints();
    if  (!gameData.players[gameData.bidder].team) {
        if (gameData.bid == 7){
            if (points[0] == 6) {
               if (gameData.redTeam.score < 0)
                    gameData.redTeam.score = 0;
                else
                    gameData.redTeam.score = 21;
            } else {
                gameData.redTeam.score -= 21;
                gameData.blueTeam.score += points[1];
            }
        } else if (points[0] >= gameData.bid) {
            gameData.redTeam.score += points[0];
            gameData.blueTeam.score += points[1];
        } else {
            gameData.redTeam.score -= gameData.bid;
            gameData.blueTeam.score += points[1];
        }
    } else {
        if (gameData.bid == 7){
            if (points[1] == 6) {
               if (gameData.blueTeam.score < 0)
                    gameData.blueTeam.score = 0;
                else
                    gameData.blueTeam.score = 21;
            } else {
                gameData.blueTeam.score -= 21;
                gameData.redTeam.score += points[0];
            }
        } else if (points[1] >= gameData.bid) {
            gameData.blueTeam.score += points[1];
            gameData.redTeam.score += points[0];
        } else {
            gameData.blueTeam.score -= gameData.bid;
            gameData.redTeam.score += points[0];
        }
    }
}

function trick(player) {
    if (player.index == gameData.leader)
        gameData.players.forEach(player => player.current = undefined);
    gameData.players[player.index].current = player.selectedCard;
    gameData.players[player.index].hand.splice(gameData.players[player.index].hand.indexOf(player.selectedCard),1);
    gameData.lastGameLog = player.displayName + ' plays the ' + card2str(player.selectedCard) + '. ' + nextPlayer().displayName + "'s turn.";
    if (gameData.turn == gameData.leader) {
        let bestplayer = bestPlayer();
        if (!bestplayer.team)
            gameData.redTeam.stash = gameData.redTeam.stash.concat(currentCards());
        else
            gameData.blueTeam.stash = gameData.blueTeam.stash.concat(currentCards());
        gameData.turn = bestplayer.index;
        gameData.leader = bestplayer.index;
        gameData.lastGameLog = bestplayer.displayName + ' gets the trick. ' + bestplayer.displayName + "'s lead.";
        if (gameData.players[gameData.leader].hand.length == 0){
            tallyPoints();
            if (gameData.redTeam.score >= 21 && gameData.blueTeam.score >= 21) {
                let winTeam = gameData.players[gameData.dealer].team;
                gameData.winner = winTeam;
                gameData.state = FINAL;
                gameData.lastGameLog = (!winTeam ? 'RED' : 'BLUE') + ' TEAM WINS!';
            } else if (gameData.redTeam.score >= 21) {
                gameData.winner = 0;
                gameData.state = FINAL;
                gameData.lastGameLog = 'RED TEAM WINS!';
            } else if (gameData.blueTeam.score >= 21) {
                gameData.winner = 1;
                gameData.state = FINAL;
                gameData.lastGameLog = 'BLUE TEAM WINS!';
            } else {
                gameData.dealer = (gameData.dealer+1)%4;
                gameData.state = DEAL;
                gameData.bidder = -1;
                gameData.bid = -1;
                gameData.leader = -1;
                gameData.trump = -1;
                gameData.redTeam.stash = [];
                gameData.blueTeam.stash = [];
                gameData.lastGameLog = 'Points tallied. ' + gameData.players[gameData.dealer].displayName + "'s deal.";
            }
        }
    }
    sendPlayerData();
    sendGameData();
}

function play(player) {
    switch(gameData.state) {
        case PREGAME:
            if (fullLobby()) {
                start();
            } else {
                sendServerMessage(player, "Waiting for players...");
            }
            break;
        case DEAL:
            if (player.index == gameData.dealer) {
                deal(player);
            } else {
                sendServerMessage(player, "Waiting on the dealer.","red");
            }
            break;
        case BID:
            if (player.index == gameData.turn) {
                if (player.selectedBid != undefined) {
                    bid(player);
                } else {
                    sendServerMessage(player, "Choose a bid, then press PLAY.", "red");
                }
            } else {
                sendServerMessage(player, "It's not your turn.", "red");
            }
            break;
        case PICKSUIT:
            if (player.index == gameData.bidder) {
                if (player.selectedSuit != undefined) {
                    trump(player);
                } else {
                    sendServerMessage(player, "Choose a suit, then press PLAY.","red");
                }
            } else {
                sendServerMessage(player, "Waiting on the bidder.","red");
            }
            break;
        case DEAL2:
            if (player.index == gameData.dealer) {
                deal2(player);
            } else {
                sendServerMessage(player, "Waiting on the dealer.","red");
            }
            break;
        case TRICK:
            if (player.index == gameData.turn) {
                if (player.selectedCard != undefined) {
                    if (canPlay(player, player.selectedCard)) {
                        trick(player);
                    } else {
                        sendServerMessage(player, "You can't play that card. You must follow lead suit if you have one.", "red");
                    }
                } else {
                    sendServerMessage(player, "Choose a card, then press PLAY.","red");
                }
            } else {
                sendServerMessage(player, "It's not your turn.", "red");
            }
            break;
        case FINAL:
            start();
            break;
    }
}