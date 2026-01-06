import { createInputListener } from "../factory";
import { mouseHandlers } from "./handlers";

createInputListener("mouse", mouseHandlers);
