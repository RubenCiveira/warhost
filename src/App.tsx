import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import RequireAccess from "./components/RequireAccess";
import RequiereCobertura from "./components/RequiereCobertura";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Verify from "./pages/Verify";
import OAuth from "./pages/OAuth";
const Home = lazy(() => import("./pages/Home"));
const ArmyList = lazy(() => import("./pages/armies/ArmyList"));
const ArmyEditor = lazy(() => import("./pages/armies/ArmyEditor"));
const GameList = lazy(() => import("./pages/games/GameList"));
const GameNew = lazy(() => import("./pages/games/GameNew"));
const GameLive = lazy(() => import("./pages/games/GameLive"));
const AssociationList = lazy(() => import("./pages/associations/AssociationList"));
const AssociationDetail = lazy(() => import("./pages/associations/AssociationDetail"));
const CatalogBooks = lazy(() => import("./pages/catalog/CatalogBooks"));
const ArmyBuilder = lazy(() => import("./pages/catalog/ArmyBuilder"));
const CatalogBook = lazy(() => import("./pages/catalog/CatalogBook"));
const RulesIndex = lazy(() => import("./pages/rules/RulesIndex"));
const MissionCards = lazy(() => import("./pages/missions/MissionCards"));
const HeroClasses = lazy(() => import("./pages/heroClasses/HeroClasses"));
const MapLab = lazy(() => import("./modules/examples/debug/presentation/MapLab"));

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/verify" element={<Verify />} />
      <Route path="/oauth" element={<OAuth />} />
      <Route path="/maps" element={<main className="content"><Suspense fallback={null}><MapLab /></Suspense></main>} />
      <Route
        element={
          <RequireAccess>
            <Layout />
          </RequireAccess>
        }
      >
        <Route path="/" element={<Home />} />
        <Route path="/ejercitos" element={<ArmyList />} />
        <Route path="/ejercitos/nuevo" element={<RequiereCobertura><ArmyEditor /></RequiereCobertura>} />
        <Route path="/ejercitos/:armyId" element={<ArmyEditor />} />
        <Route path="/ejercitos/:armyId/unidades" element={<RequiereCobertura><ArmyBuilder /></RequiereCobertura>} />
        <Route path="/partidas" element={<GameList />} />
        <Route path="/partidas/nueva" element={<GameNew />} />
        <Route path="/partidas/:gameId" element={<GameLive />} />
        <Route path="/asociaciones" element={<AssociationList />} />
        <Route path="/asociaciones/:associationId" element={<AssociationDetail />} />
        <Route path="/facciones" element={<RequiereCobertura><CatalogBooks /></RequiereCobertura>} />
        <Route path="/facciones/:bookKey" element={<RequiereCobertura><CatalogBook /></RequiereCobertura>} />
        <Route path="/facciones/:bookKey/crear" element={<RequiereCobertura><ArmyBuilder /></RequiereCobertura>} />
        <Route path="/reglas" element={<RulesIndex />} />
        <Route path="/misiones" element={<MissionCards />} />
        <Route path="/clases" element={<HeroClasses />} />
        <Route path="/mapas" element={<MapLab />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
