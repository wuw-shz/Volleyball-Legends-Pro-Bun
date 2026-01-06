import { createInputListener } from "../factory";
import { keyboardHandlers } from "./handlers";

createInputListener("keyboard", keyboardHandlers);
