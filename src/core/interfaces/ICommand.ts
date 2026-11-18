export interface ICommand {
  readonly id: string;
  readonly label: string;
  readonly timestamp: number;
  execute(): void;
  undo(): void;
}
