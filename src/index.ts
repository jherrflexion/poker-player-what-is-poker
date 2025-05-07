import express from 'express';
import { PokerBot } from './PokerBot';
import { GameState } from './GameState';

const VERSION = PokerBot.VERSION;

const app = express();
const player = new PokerBot();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/', ({}, res) => res.status(200).send('OK'));

app.post('/', (req, res) => {
    if (req.body.action === 'bet_request') {
        try {
            const gameState = new GameState(JSON.parse(req.body.game_state));
            player.betRequest(gameState, bet => res.status(200).send(bet.toString()));
        } catch (e) {
            console.error('Error parsing game state:', e);
            res.status(500).send('Error');
        }
    } else if (req.body.action === 'showdown') {
        try {
            const gameState = new GameState(JSON.parse(req.body.game_state));
            player.showdown(gameState);
            res.status(200).send('OK');
        } catch (e) {
            console.error('Error parsing game state:', e);
            res.status(500).send('Error');
        }
    } else if (req.body.action === 'version') {
        res.status(200).send(VERSION);
    } else {
        res.status(200).send('OK');
    }
});

const port = parseInt(process.env['PORT'] || '1337');
const host = "0.0.0.0";
app.listen(port, host);
console.log('Listening at http://' + host + ':' + port);
