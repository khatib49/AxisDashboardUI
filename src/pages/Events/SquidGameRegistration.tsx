// DEPRECATED — superseded by EventRegistrationPage.tsx.
//
// Events are now admin-managed (Admin → Events), so the public page is
// fully data-driven and lives at /events/:eventKey. This file is kept only
// as a redirect so any old bookmark or shared link still lands somewhere
// sensible. Safe to delete once no external links point at it.

import { Navigate } from "react-router";

export default function SquidGameRegistration() {
  return <Navigate to="/events/squid-game-x-axis" replace />;
}
