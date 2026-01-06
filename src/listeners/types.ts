export type HandlerAction = () => void | Promise<void>;

export interface Handler {
  name: string;
  on: {
    down?: HandlerAction;
    up?: HandlerAction;
  };
}

export type InputType = "keyboard" | "mouse";
