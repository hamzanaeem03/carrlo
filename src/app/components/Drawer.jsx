"use client";

import * as React from "react";
import Box from "@mui/material/Box";
import Drawer from "@mui/material/Drawer";
import IconButton from "@mui/material/IconButton";
import Avatar from "@mui/material/Avatar";
import MenuIcon from "@mui/icons-material/Menu";
import HomeRoundedIcon from "@mui/icons-material/HomeRounded";
import DirectionsCarRoundedIcon from "@mui/icons-material/DirectionsCarRounded";
import CalendarMonthRoundedIcon from "@mui/icons-material/CalendarMonthRounded";
import PeopleAltRoundedIcon from "@mui/icons-material/PeopleAltRounded";
import PaymentsRoundedIcon from "@mui/icons-material/PaymentsRounded";
import BarChartRoundedIcon from "@mui/icons-material/BarChartRounded";
import BuildRoundedIcon from "@mui/icons-material/BuildRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import PlaceOutlinedIcon from "@mui/icons-material/PlaceOutlined";
import AccessTimeRoundedIcon from "@mui/icons-material/AccessTimeRounded";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";

const navItems = [
  { text: "Overview", href: "/dashboard", icon: HomeRoundedIcon },
  { text: "Fleet", href: "/dashboard/vehicles", icon: DirectionsCarRoundedIcon },
  { text: "Customers", href: "/dashboard/customers", icon: PeopleAltRoundedIcon },
  { text: "Bookings", href: "/dashboard/bookings", icon: CalendarMonthRoundedIcon },
  { text: "Payments", href: "/dashboard/payments", icon: PaymentsRoundedIcon },
  { text: "Service", href: "/dashboard/fleet", icon: BuildRoundedIcon },
  { text: "Reports", href: "/dashboard/reports", icon: BarChartRoundedIcon },
];

function NavLinks({ onNavigate }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-2 lg:flex-row lg:items-center">
      {navItems.map((item) => {
        const Icon = item.icon;
        const active =
          pathname === item.href ||
          (item.href !== "/dashboard" && pathname?.startsWith(item.href));

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={`flex h-12 items-center gap-2 rounded-full px-5 text-sm font-medium transition ${
              active
                ? "bg-black text-white shadow-sm"
                : "bg-white/70 text-[#5e5a56] hover:bg-white"
            }`}
          >
            <Icon fontSize="small" />
            <span>{item.text}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function ResponsiveDrawer(props) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = React.useState(false);

  if (pathname?.startsWith("/sign-in")) {
    return props.children;
  }

  return (
    <Box className="min-h-screen bg-[#b8b5b5] p-3 text-[#161412] sm:p-6 lg:p-10">
      <Box className="mx-auto min-h-[calc(100vh-48px)] max-w-[1720px] rounded-[28px] border-4 border-white bg-[#eeeae5] p-4 shadow-[0_24px_80px_rgba(37,37,37,0.16)] sm:p-6">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <IconButton
              aria-label="Open navigation"
              onClick={() => setMobileOpen(true)}
              sx={{
                display: { lg: "none" },
                backgroundColor: "white",
                width: 48,
                height: 48,
              }}
            >
              <MenuIcon />
            </IconButton>
            <Link href="/dashboard" className="text-3xl font-bold tracking-[0]">
              Carrlo
            </Link>
          </div>

          <div className="hidden lg:block">
            <NavLinks />
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden h-12 items-center gap-2 rounded-full bg-white/80 px-5 text-sm text-[#6b6762] md:flex">
              <PlaceOutlinedIcon fontSize="small" />
              Main Branch
            </div>
            <div className="hidden h-12 items-center gap-2 rounded-full bg-white/80 px-5 text-sm text-[#6b6762] md:flex">
              <AccessTimeRoundedIcon fontSize="small" />
              Operations
            </div>
            <IconButton
              aria-label="Search"
              sx={{ width: 48, height: 48, backgroundColor: "white" }}
            >
              <SearchRoundedIcon />
            </IconButton>
            <Avatar sx={{ width: 48, height: 48 }}>
              <Image
                src="/account-img.png"
                alt="Account"
                width={48}
                height={48}
              />
            </Avatar>
          </div>
        </header>

        <main>{props.children}</main>
      </Box>

      <Drawer
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        PaperProps={{
          sx: {
            width: 300,
            backgroundColor: "#eeeae5",
            borderRight: "none",
            p: 2,
          },
        }}
      >
        <div className="mb-6 px-3 pt-3 text-3xl font-bold">Carrlo</div>
        <NavLinks onNavigate={() => setMobileOpen(false)} />
      </Drawer>
    </Box>
  );
}

export default ResponsiveDrawer;
