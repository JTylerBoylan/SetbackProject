const PORT = 3000;

function goToPort() {
    if (window.location.port != PORT)
        window.location.replace("http://setback.jtyler.site:" + PORT);
}

goToPort();

let myData = {};
let gameData = {};
let sortType = 0;
let reset = false;

// SERVER CONNECTION
function connectToServer() {
    socket = io.connect('http://setback.jtyler.site:' + PORT);
    socket.on('connect', function(data) {
        socket.emit('join', myData);
    });
    socket.on('playerdata', function(playerData){
        myData = playerData;
    });
    socket.on('gamedata', function(gamedata){
        gameData = gamedata;
        refresh();
    });
    socket.on('servermsg', function(message, color) {
        print2Log(message,color);
    });
    socket.on('kick', function() {
        window.location.reload();
    });
}

function onNameButtonClick() {
    var inputName = document.getElementById("displayname").value;
    myData.displayName = !inputName ? "Guest Player" : inputName;
    const enterNameDiv = document.getElementById("entername");
    const teamSelectDiv = document.getElementById("teamselect");
    enterNameDiv.style.display = "none";
    teamSelectDiv.style.display = "flex";
}

function onTeamButtonClick(selectedTeam) {
    myData.team = selectedTeam;
    const teamSelectDiv = document.getElementById("teamselect");
    const gameDiv = document.getElementById("game");
    teamSelectDiv.style.display = "none";
    gameDiv.style.display = "flex";
    connectToServer();
}

function resetGame() {
    document.getElementById("winner").style.display = "none";
    if (reset || gameData.state == 6)
        socket.emit('reset');
    reset = !reset;
}

function print2Log(logMessage, color) {
    const gameLogText = document.getElementById("gamelogtxt");
    gameLogText.innerText = logMessage;
    gameLogText.style.color = color == undefined ? 'black' : color;
}

function getPlayerLeft() {
    return gameData.players[(myData.index+1)%4];
}

function getPlayerTop() {
    return gameData.players[(myData.index+2)%4];
}

function getPlayerRight() {
    return gameData.players[(myData.index+3)%4];
}

function refreshPlayerNames(){
    let playerLeftName = document.getElementById("playerleftname");
    let playerTopName = document.getElementById("playertopname");
    let playerRightName = document.getElementById("playerrightname");
    playerLeftName.innerText = getPlayerLeft().displayName;
    playerTopName.innerText = getPlayerTop().displayName;
    playerRightName.innerText = getPlayerRight().displayName;
    if (!myData.team){
        playerLeftName.style.color = 'darkblue';
        playerTopName.style.color = 'firebrick';
        playerRightName.style.color = 'darkblue';
    } else {
        playerLeftName.style.color = 'firebrick';
        playerTopName.style.color = 'darkblue';
        playerRightName.style.color = 'firebrick';
    }
}

function card2value(card) {
    if (card == 52)
        return 50;
    let value = card%13;
    if (gameData.trump != -1) {
        if (Math.floor(card/13) == gameData.trump)
            value += 13;
        if (card == ((gameData.trump+2)%4)*13 + 9)
            value += 12.5;
    }
    return value;
}

function getHand() {
    let hand = myData.hand == undefined ? [] : myData.hand.slice();
    let suit = myData.selectedSuit;
    if (sortType)
        hand.sort(function(a,b) {
            switch(sortType){
                case 1: return card2value(b) - card2value(a);
                case 2: return card2value(a) - card2value(b);
            }
        });
    if (suit != undefined)
        hand = hand.filter(card => {
            return Math.floor(card/13) == suit || (card == ((suit+2)%4)*13+9) || card == 52;
        });
    return hand;
}

function refreshHand() {
    let idx = 0;
    getHand().forEach(card => {
        let cardImage = document.getElementById('card' + idx++ + 'image');
        cardImage.style.visibility = 'visible';
        cardImage.src = "src/images/cards/" + card + ".png";
    });
    for (let i = idx; i < 12; i++) {
        let cardImage = document.getElementById('card' + i + 'image');
        cardImage.style.visibility = 'hidden';
    }
}

function refreshPlayCards() {
    let myPlayCard = document.getElementById("myplayimage");
    let leftPlayCard = document.getElementById("leftplayimage");
    let topPlayCard = document.getElementById("topplayimage");
    let rightPlayCard = document.getElementById("rightplayimage");
    let playerLeft = getPlayerLeft();
    let playerTop = getPlayerTop();
    let playerRight = getPlayerRight();
    if (myData.current != undefined){
        myPlayCard.src = "src/images/cards/" + myData.current + ".png";
        myPlayCard.style.visibility = 'visible';
    } else {
        myPlayCard.src = "src/images/cards/H.png";
        myPlayCard.style.visibility = 'hidden';
    }
    if (playerLeft != undefined && playerLeft.current != undefined){
        leftPlayCard.src = "src/images/cards/" + playerLeft.current + ".png";
        leftPlayCard.style.visibility = 'visible';
    } else {
        leftPlayCard.src = "src/images/cards/H.png";
        leftPlayCard.style.visibility = 'hidden';
    }
    if (playerTop != undefined && playerTop.current != undefined){
        topPlayCard.src = "src/images/cards/" + playerTop.current + ".png";
        topPlayCard.style.visibility = 'visible';
    } else {
        topPlayCard.src = "src/images/cards/H.png";
        topPlayCard.style.visibility = 'hidden';
    }
    if (playerRight != undefined && playerRight.current != undefined){
        rightPlayCard.src = "src/images/cards/" + playerRight.current + ".png";
        rightPlayCard.style.visibility = 'visible';
    } else {
        rightPlayCard.src = "src/images/cards/H.png";
        rightPlayCard.style.visibility = 'hidden';
    }
}

function showPlayerCardImages(tf){
    let playerCardImages = document.getElementsByClassName("playerimage");
    for (let i = 0; i < playerCardImages.length; i++)
        playerCardImages[i].style.visibility = tf ? 'visible' : 'hidden';
}

function showPileImage(tf){
    let pileImage = document.getElementById("pileimage");
    pileImage.style.visibility = tf ? 'visible' : 'hidden';
}

function showBids(tf){
    document.getElementById("biddiv").style.visibility = tf ? 'visible' : 'hidden';
}

function showSuitButtons(tf) {
    let suitdiv = document.getElementById("suitdiv");
    suitdiv.style.visibility = tf && gameData.bidder == myData.index ? 'visible' : 'hidden';
}

function showWinners(tf) {
    let winnerdiv = document.getElementById("winner");
    winnerdiv.style.display = tf ? 'block' : 'none';
}

function refreshGameImages() {
    switch(gameData.state){
        case 0:
            showPlayerCardImages(false);
            showPileImage(false);
            showBids(false);
            showSuitButtons(false);
            showWinners(false);
            break;
        case 1:
            showPlayerCardImages(false);
            showPileImage(false);
            showBids(false);
            showSuitButtons(false);
            showWinners(false);
            break;
        case 2:
            showPlayerCardImages(true);
            showPileImage(true);
            showBids(true);
            showSuitButtons(false);
            showWinners(false);
            break;
        case 3:
            showPlayerCardImages(true);
            showPileImage(false);
            showBids(false);
            showSuitButtons(true);
            showWinners(false);
            break;
        case 4:
            showPlayerCardImages(true);
            showPileImage(false);
            showBids(false);
            showSuitButtons(false);
            showWinners(false);
            break;
        case 5:
            showPlayerCardImages(true);
            showPileImage(false);
            showBids(false);
            showSuitButtons(false);
            showWinners(false);
            break;
        case 6:
            showPlayerCardImages(false);
            showPileImage(false);
            showBids(false);
            showSuitButtons(false);
            showWinners(true);
            break;

    }
}

function refreshGameLog() {
    print2Log(gameData.lastGameLog, 'black');
}

function refreshScore() {
    let redTeamScore = document.getElementById("redteamscore");
    let blueTeamScore = document.getElementById("blueteamscore");
    redTeamScore.innerText = gameData.redTeam.score;
    blueTeamScore.innerText = gameData.blueTeam.score;
    redTeamScore.style.color = gameData.redTeam.score < 0 ? 'red' : 'antiquewhite';
    blueTeamScore.style.color = gameData.blueTeam.score < 0 ? 'red' : 'antiquewhite';
}

function refreshWinner() {
    if (gameData.winner != -1) {
        let teamIndices = !gameData.winner ? [0,2] : [1,3];
        let winner1 = gameData.players[teamIndices[0]];
        let winner2 = gameData.players[teamIndices[1]];
        let winner1text = document.getElementById("winner1");
        let winner2text = document.getElementById("winner2");
        winner1text.innerHTML = winner1.displayName;
        winner2text.innerHTML = winner2.displayName;
    }
}

function refresh() {
    reset = false;
    refreshPlayerNames();
    refreshHand();
    refreshPlayCards();
    refreshGameImages();
    refreshGameLog();
    refreshScore();
    refreshWinner();
}

function sendCardToBack(card){
    let cardIdx = myData.hand.indexOf(card);
    let drop = myData.hand.splice(cardIdx,1)[0];
    myData.hand.push(drop);
}

function selectCard(cardPos) {
    myData.selectedCard = getHand()[cardPos];
    if (gameData.state == 3) {
        sendCardToBack(myData.selectedCard);
    } else {
        for (let i = 0; i <= 11; i++){
            let cardImage = document.getElementById("card" + i + "image");
            if (i == cardPos){
                cardImage.style.border = "solid rgb(184, 219, 180) 0.5vh";
            } else {
                cardImage.style.border = "solid rgb(76, 156, 69) 0.5vh";
            }
        }
    }
    refreshHand();
}

function selectBid(bidPos) {
    myData.selectedBid = bidPos;
    for (let i = 1; i <= 6; i++){
        let bidButton = document.getElementById('bid' + i);
        if (i == bidPos) {
            bidButton.style.backgroundColor = "rgb(76, 156, 69)";
        } else {
            bidButton.style.backgroundColor = "antiquewhite";
        }
    }
    let bid6OutButton = document.getElementById('bid6out');
    let passButton = document.getElementById('pass');
    if (bidPos == 7){
        bid6OutButton.style.backgroundColor = "rgb(76, 156, 69)";
    } else {
        bid6OutButton.style.backgroundColor = "antiquewhite";
    }
    if (bidPos == 8){
        passButton.style.backgroundColor = "rgb(76, 156, 69)";
    } else {
        passButton.style.backgroundColor = "antiquewhite";
    }
}

function selectSuit(suitPos) {
    myData.selectedSuit = suitPos;
    for (let i = 0; i <= 3; i++){
        let cardImage = document.getElementById("suit" + i + "button");
        if (i == suitPos){
            cardImage.style.backgroundColor = "rgb(76, 156, 69)";
        } else {
            cardImage.style.backgroundColor = "antiquewhite";
        }
    }
    refreshHand();
}

function unselectAll() {
    selectCard(undefined);
    selectSuit(undefined);
    selectBid(undefined);
}

function sort() {
    sortType = (sortType+1)%3;
    refreshHand();
}

function play() {
    socket.emit('play', myData);
    unselectAll();
}