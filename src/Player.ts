import { CardProps } from './Card';

export interface PlayerProps {
    id: number; // Id of the player
    name: string; // Name of the player
    status: 'active' | 'folded' | 'out'; // Status of the player
    version: string; // Version identifier returned by the player
    stack: number; // Chips available for the player
    bet: number; // Chips the player put into the pot
    hole_cards?: CardProps[]; // Cards of the player (only visible for own player or after showdown)
}

export class Player {
    id: number; // Id of the player
    name: string; // Name of the player
    status: 'active' | 'folded' | 'out'; // Status of the player
    version: string; // Version identifier returned by the player
    stack: number; // Chips available for the player
    bet: number; // Chips the player put into the pot
    hole_cards?: CardProps[];

    constructor(props: PlayerProps) {
        this.id = props.id;
        this.name = props.name;
        this.status = props.status;
        this.version = props.version;
        this.stack = props.stack;
        this.bet = props.bet;
        this.hole_cards = props.hole_cards || [];
    }
}