import { Routes, Route } from "react-router-dom";
import Login from "./pages/Login";
import Positions from "./pages/Positions";
import Journal from "./pages/Journal";
import SignUp from "./pages/Signup";
import Profile from "./pages/Profile";
import RedirectHandler from "./components/RedirectHandler";


export default function AppRoutes() {
  return (
    <div>
      <Routes>
        <Route path="/positions" element={<Positions />} />
        <Route path="/journal" element={<Journal />} />
        <Route path="/" element={<RedirectHandler/>} />
        <Route path="/login" element={<Login />} />

        <Route path="/signup" element={<SignUp />} />
        <Route path="/profile" element={<Profile />} />
      </Routes>
    </div>
  );
}
