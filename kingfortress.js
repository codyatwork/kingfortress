var board,
    game = new Chess(),
    endText = $('#end-text'),
    specialPiece,
    specialSquare,
    inSpecial = false,
    unfinishedMoveSource,
    unfinishedMoveTarget;

const animationSpeed = 200;

function advanceTurn() {
    var move;
    var square = 'a1';
    var extraPieceSquare;
    while (true) {
        move = game.moves({ verbose: true })[0];
        if (move) break;
        if (!game.get(square)) {
            game.put({ type: 'q', color: game.turn() }, square);
            if (extraPieceSquare) {
                game.remove(extraPieceSquare);
            }
            extraPieceSquare = square;
        }
        if (square.charAt(1) == '8') {
            square = nextChar(square.charAt(0)) + '1';
        } else {
            square = square.charAt(0) + (parseInt(square.charAt(0)) + 1);
        }
    }
    var toPiece = game.get(move.to);
    var fromPiece = game.get(move.from);
    game.move(move);
    if (toPiece) {
        game.put(toPiece, move.to);
    } else {
        game.remove(move.to);
    }
    game.put(fromPiece, move.from);
    if (extraPieceSquare) {
        game.remove(extraPieceSquare);
    }
    onSnapEnd();
}

function endTurn() {
    $.each($('.stunned'), function () {
        if (this.firstChild.dataset.piece.charAt(0) == game.turn()) {
            $(this).removeClass('stunned');
        }
    });
}

function getAdjacentSquares(square) {
    var file = square.charAt(0);
    var rank = parseInt(square.charAt(1));
    var adjacentSquares = [];
    if (file != "a") {
        adjacentSquares.push(previousChar(file) + rank);
    }
    if (file != "h") {
        adjacentSquares.push(nextChar(file) + rank);
    }
    if (rank != 1) {
        adjacentSquares.push(file + (rank - 1));
    }
    if (rank != 8) {
        adjacentSquares.push(file + (rank + 1));
    }
    if (file != "a" && rank != 8) {
        adjacentSquares.push(previousChar(file) + (rank + 1));
    }
    if (file != "h" && rank != 8) {
        adjacentSquares.push(nextChar(file) + (rank + 1));
    }
    if (file != "h" && rank != 1) {
        adjacentSquares.push(nextChar(file) + (rank - 1));
    }
    if (file != "a" && rank != 1) {
        adjacentSquares.push(previousChar(file) + (rank - 1));
    }
    return adjacentSquares;
}

function endSpecial() {
    $('.red1').removeClass('red1');
    $('.red2').removeClass('red2');
    board.stopDraggedPiece(specialSquare);
    inSpecial = false;
}

function nextChar(c) {
    return String.fromCharCode(c.charCodeAt(0) + 1);
}

function previousChar(c) {
    return String.fromCharCode(c.charCodeAt(0) - 1);
}

var specialMoves = function (square, fullPiece) {
    var moves = [];
    var piece;
    var color;
    if (typeof fullPiece === 'string' || fullPiece instanceof String) {
        color = fullPiece.charAt(0);
        piece = fullPiece.charAt(1);
    } else {
        color = fullPiece.color;
        piece = fullPiece.type.toUpperCase();
    }
    switch (piece) {
        case "K":
            var possibleMoves = getAdjacentSquares(square);
            possibleMoves.forEach(function (move) {
                if (game.get(move) && game.get(move).color != color && game.get(move).type != "w") {
                    if (game.in_check()) {
                        var stunPiece = game.get(move);
                        game.put({ type: 'w', color: stunPiece.color }, move);
                        if (!game.in_check()) {
                            moves.push(move);
                        }
                        game.put({ type: stunPiece.type, color: stunPiece.color }, move);
                    } else {
                        moves.push(move);
                    }
                }
            });
            return moves;
        case "N":
            var possibleMoves = game.moves({ square: square, verbose: true });
            possibleMoves.forEach(function (move) {
                if (move.flags.includes("c")) {
                    if (game.in_check()) {
                        var snipePiece = game.get(move.to);
                        game.remove(move.to);
                        if (!game.in_check()) {
                            moves.push(move.to);
                        }
                        game.put({ type: snipePiece.type, color: snipePiece.color }, move.to);
                    } else {
                        moves.push(move.to);
                    }
                }
            });
            return moves;
        case "R":
            var possibleMoves = getAdjacentSquares(square);
            possibleMoves.forEach(function (move) {
                if (game.get(move) == null) {
                    if (game.in_check()) {
                        game.put({ type: 'w', color: color }, move);
                        if (!game.in_check()) {
                            moves.push(move);
                        }
                        game.remove(move);
                    } else {
                        moves.push(move);
                    }
                }
            });
            return moves;
        case "B":
            if (game.in_check() || $('#board .square-' + square).hasClass('cloaked')) {
                return [];
            } else {
                return [square];
            }
        default:
            return [];
    }
}

var removeHighlights = function () {
    $('.grey1').removeClass('grey1');
    $('.grey2').removeClass('grey2');
    $('.red1').removeClass('red1');
    $('.red2').removeClass('red2');
    board.removeYellowHighlights();
}

var highlightSquare = function (square, color) {
    var squareEl = $('#board .square-' + square);
    var highlightClass;
    if (color == "grey") {
        highlightClass = 'grey1';
        if (squareEl.hasClass('black-3c85d') === true) {
            highlightClass = 'grey2';
        }
    } else {
        highlightClass = 'red1';
        if (squareEl.hasClass('black-3c85d') === true) {
            highlightClass = 'red2';
        }
        squareEl.addClass("target");
    }
    squareEl.addClass(highlightClass);
};

var onDragStart = function (piece) {
    // do not pick up pieces if the game is over or if it's not that side's turn
    if (game.game_over() === true ||
        (game.turn() === 'w' && piece.search(/^b/) !== -1) ||
        (game.turn() === 'b' && piece.search(/^w/) !== -1)) {
        return false;
    }
};

var onDrop = function (source, target) {
    removeHighlights();
    if (inSpecial) return;
    $(".special").hide();

    // see if the move is legal
    var move = game.move({
        from: source,
        to: target,
        promotion: 'q' // always promote to a queen, overwrite later
    });

    // illegal move
    if (move === null) return 'snapback';

    if (move.flags.includes("p")) {
        unfinishedMoveSource = source;
        unfinishedMoveTarget = target;
        document.getElementById("promotion-menu").style.display = 'flex';
    } else {
        completeMove(source, target, "none");
    }
};

var completeMove = function (source, target, promotion) {
    if (document.getElementsByClassName("square-" + source)[0].classList.contains("cloaked")) {
        board.position(game.fen(), false);
    } else {
        if (promotion != "none") {
            game.put({ type: promotion, color: game.get(target).color }, target);
        }
        onSnapEnd();
        document.getElementsByClassName("square-" + target)[0].classList.remove("cloaked");
    }
    endTurn();
    game.log_move();
    updateStatus();
}

var onMouseoverSquare = function (square, piece) {
    if (piece && piece.charAt(0) == game.turn() && !game.game_over() && !$('#board .square-' + square).hasClass("stunned")) {
        // get list of possible moves for this square
        var moves = game.moves({
            square: square,
            verbose: true
        });
        var specials = specialMoves(square, piece);

        // exit if there are no moves available for this square
        if (moves.length === 0 && specials.length === 0) return;

        // highlight the square they moused over
        highlightSquare(square, "grey");

        // highlight the possible squares for this piece
        for (var i = 0; i < moves.length; i++) {
            highlightSquare(moves[i].to, "grey");
        }
    }
};

var onSnapEnd = function () {
    board.position(game.fen());
};

var updateStatus = function () {
    // checkmate?
    if (game.in_checkmate() === true) {
        endText.stop(true, true);
        endText.html('CHECKMATE');
        endText.show();
    }
    // draw?
    else if (game.in_draw() === true) {
        endText.stop(true, true);
        endText.html('STALEMATE');
        endText.show();
    }
    // check?
    else if (game.in_check() === true) {
        endText.html('CHECK');
        endText.stop(true, true);
        endText.show();
        endText.fadeOut(4000);
    }
};

var cfg = {
    draggable: true,
    position: 'start',
    onDragStart: onDragStart,
    onDrop: onDrop,
    onMouseoutSquare: removeHighlights,
    onMouseoverSquare: onMouseoverSquare,
    onSnapEnd: onSnapEnd
};
board = Chessboard('board', cfg);

document.addEventListener('click', function (event) {
    if (event.target.parentElement && event.target.parentElement.matches('.target')) {
        switch (specialPiece.charAt(1)) {
            case "K":
                event.target.parentElement.classList.add("stunned");
                break;
            case "N":
                game.remove(event.target.parentElement.dataset.square);
                break;
            default:
                break;
        }
        endSpecial();
        endTurn();
        advanceTurn();
        game.log_move();
    } else if (event.target.matches('.target')) {
        game.put({ type: 'w', color: specialPiece.charAt(0) }, event.target.dataset.square);
        endSpecial();
        endTurn();
        advanceTurn();
        game.log_move();
    } else if (event.target.matches('.restart')) {
        endSpecial();
        game.reset();
        board.start();
        endText.hide();
        removeHighlights();
        $('.stunned').removeClass('stunned');
        $('.cloaked').fadeIn(animationSpeed, function () {
            $('.cloaked').removeClass('cloaked');
        });
    } else if (event.target.matches('.promotion-button')) {
        completeMove(unfinishedMoveSource, unfinishedMoveTarget, event.target.id.charAt(8));
        document.getElementById("promotion-menu").style.display = 'none';
    }
    if (!event.target.matches('.special')) {
        $('.target').removeClass("target");
    }
}, false);

document.addEventListener('keydown', (event) => {
    if (event.key === ' ') {
        event.preventDefault();
        var cloaked = document.getElementsByClassName("cloaked");
        Array.prototype.forEach.call(cloaked, function (element) {
            var cloakedChildren = element.children;
            Array.prototype.forEach.call(cloakedChildren, function (child) {
                if (child.dataset.piece && child.dataset.piece.charAt(0) == game.turn()) {
                    element.classList.add("peek");
                }
            });
        });
    }
}, false);

document.addEventListener('keyup', (event) => {
    if (event.key === ' ') {
        var peek = document.getElementsByClassName("peek");
        while (peek.length)
            peek[0].classList.remove("peek");
    }
}, false);