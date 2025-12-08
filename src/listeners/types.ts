export type HandlerAction = () => void | Promise<void>;

export interface Handler {
   name: string;
   on: {
      down?: HandlerAction;
      up?: HandlerAction;
   };
}
export type InputType = "keyboard" | "mouse";

export function createHandler(
   name: string,
   actions: { down?: HandlerAction; up?: HandlerAction }
): Handler {
   return { name, on: actions };
}