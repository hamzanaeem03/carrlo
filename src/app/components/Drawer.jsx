"use client";
import * as React from "react";
import PropTypes from "prop-types";
import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import CssBaseline from "@mui/material/CssBaseline";
import Divider from "@mui/material/Divider";
import Drawer from "@mui/material/Drawer";
import IconButton from "@mui/material/IconButton";
import InboxIcon from "@mui/icons-material/MoveToInbox";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import MailIcon from "@mui/icons-material/Mail";
import MenuIcon from "@mui/icons-material/Menu";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import Image from "next/image";
import { Avatar } from "@mui/material";

const drawerWidth = 240;

function ResponsiveDrawer(props) {
  const { window } = props;
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [isClosing, setIsClosing] = React.useState(false);

  const handleDrawerClose = () => {
    setIsClosing(true);
    setMobileOpen(false);
  };

  const handleDrawerTransitionEnd = () => {
    setIsClosing(false);
  };

  const handleDrawerToggle = () => {
    if (!isClosing) {
      setMobileOpen(!mobileOpen);
    }
  };

  const drawer = (
    <div>
      <Toolbar>
        <Typography className="font-semibold text-xl mx-5 text-[#252525]">
          Carrlo
        </Typography>
      </Toolbar>{" "}
      <List>
        {[
          { text: "Dashboard", src: "/D-icon.svg" },
          { text: "Car Inventory", src: "/CI-icon.svg" },
          { text: "Booking Request", src: "/BR-icon.svg" },
          { text: "Booking", src: "/B-icon.svg" },
          { text: "Fleet Management", src: "/FM-icoon.svg" },
          { text: "Payment Management", src: "/PM-icon.svg" },
          { text: "Report & Analytics", src: "/RA-icon.svg" },
        ].map(({ text, src }, index) => (
          <ListItem key={text} disablePadding>
            <ListItemButton>
              <Image
                src={src}
                alt={text}
                width={20}
                height={20}
                className="mx-3"
              />
              <ListItemText primary={text} className="text-[#2525255C]" />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </div>
  );

  // Remove this const when copying and pasting into your project.
  const container =
    window !== undefined ? () => window().document.body : undefined;

  return (
    <Box sx={{ display: "flex", flexGrow: 1 }}>
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          ml: { sm: `${drawerWidth}px` },
          backgroundColor: "#FDFBF9",
        }}
      >
        <Toolbar
          sx={{
            display: "flex",
            justifyContent: "space-between", // Align elements with space-between
            alignItems: "center", // Center elements vertically
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center" }}>
            <IconButton
              color="inherit"
              aria-label="open drawer"
              edge="start"
              onClick={handleDrawerToggle}
              sx={{ mr: 2, display: { sm: "none" }, color: "#2525255C" }}
            >
              <MenuIcon />
            </IconButton>
            <Typography
              variant="p"
              noWrap
              sx={{ color: "#252525" }}
              component="div"
            >
              Responsive drawer
            </Typography>
          </Box>
          <Box sx={{ alignItems: "center", display: "flex", gap: "5px" }}>
            <Avatar sx={{ backgroundColor: "#fcf3e1", alignItems: "center" }}>
              <Image width={20} height={20} src={"/notification-icon.svg"} />
            </Avatar>
            <Box className="flex justify-between items-center pr-2 *:focus:border-none rounded-full text-[#F6A60C] bg-[#fcf3e1]">
              <Avatar className="mt-2" src="/account-img.png" />

              <select className="bg-[#fcf3e1] border-none rounded-full">
                <option>William John</option>
              </select>
            </Box>
          </Box>
        </Toolbar>
      </AppBar>

      <Box
        component="nav"
        sx={{ width: { sm: drawerWidth }, flexShrink: { sm: 0 } }}
      >
        {/* The implementation can be swapped with js to avoid SEO duplication of links. */}
        <Drawer
          container={container}
          variant="temporary"
          open={mobileOpen}
          onTransitionEnd={handleDrawerTransitionEnd}
          onClose={handleDrawerClose}
          ModalProps={{
            keepMounted: true, // Better open performance on mobile.
          }}
          sx={{
            display: { xs: "block", sm: "none" },
            "& .MuiDrawer-paper": {
              boxSizing: "border-box",
              width: drawerWidth,
              backgroundColor: "#FDFBF9",
              borderRight: "none",
            },
          }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: "none", sm: "block" },
            "& .MuiDrawer-paper": {
              boxSizing: "border-box",
              width: drawerWidth,
              borderRight: "none",
              backgroundColor: "#FDFBF9",
            },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: { sm: `calc(100% - ${drawerWidth}px)` },
        }}
      >
        <Toolbar />
        {props.children}
      </Box>
    </Box>
  );
}

ResponsiveDrawer.propTypes = {
  /**
   * Injected by the documentation to work in an iframe.
   * Remove this when copying and pasting into your project.
   */
  window: PropTypes.func,
};

export default ResponsiveDrawer;
