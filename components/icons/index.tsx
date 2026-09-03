import type { ComponentType } from "react";

import Bill from "./bill";
import Box from "./box";
import Catalogue from "./catalogue";
import Close from "./close";
import Dashboard from "./dashboard";
import Debt from "./debt";
import Distribution from "./distribution";
import HandTruck from "./hand-truck";
import Hourglass from "./hourglass";
import Increase from "./increase";
import Inventory from "./inventory";
import Logout from "./logout";
import MoneyBag from "./money-bag";
import Owner from "./owner";
import Pencil from "./pencil";
import Report from "./report";
import Seller from "./seller";
import Setting from "./setting";
import ShoppingCart from "./shopping-cart";
import Ticket from "./ticket";
import Transfer from "./transfer";
import Trash from "./trash";
import Truck from "./truck";

export type IconComponent = ComponentType<{ size?: number; color?: string; className?: string }>;

export const iconMap: Record<string, IconComponent> = {
  bill: Bill,
  box: Box,
  catalogue: Catalogue,
  close: Close,
  dashboard: Dashboard,
  debt: Debt,
  distribution: Distribution,
  "hand-truck": HandTruck,
  hourglass: Hourglass,
  increase: Increase,
  inventory: Inventory,
  lockout: Hourglass,
  logout: Logout,
  "money-bag": MoneyBag,
  owner: Owner,
  pencil: Pencil,
  report: Report,
  seller: Seller,
  setting: Setting,
  "shopping-cart": ShoppingCart,
  ticket: Ticket,
  transfer: Transfer,
  trash: Trash,
  truck: Truck,
};
