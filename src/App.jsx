import { BrowserRouter } from "react-router-dom";
import AppRoutes from "./routes";
import NavBar from "./components/NavBar";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

function App() {
  return (
    <BrowserRouter>
      <ToastContainer position="top-center" autoClose={2000} />

      <div className="min-h-screen bg-gradient-to-r from-[#b2dfdb] via-[#a5d6a7] to-[#dcedc8] bg-[length:200%_200%] animate-gradient-x px-[60px] py-[30px] text-[var(--color-text)]  ">
        <div className=" flex flex-col gap-4">
          <NavBar />
          <AppRoutes />
        </div>
      </div>
    </BrowserRouter>
  );
}

export default App;
