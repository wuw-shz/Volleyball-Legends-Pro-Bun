import { createInputListener } from "./factory";
import { keyboardHandlers } from "./keyboard/index";

createInputListener("keyboard", keyboardHandlers);
