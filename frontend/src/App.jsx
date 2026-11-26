/**
 * Application principale HealthTrack
 * Gère le routing et la structure globale
 */
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './services/auth';
import { Role } from './services/auth';

// Pages
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ProfilePage from './pages/ProfilePage';

// Pages Praticien
import PraticienAgendaPage from './pages/praticien/AgendaPage';
import PraticienDisponibilitesPage from './pages/praticien/DisponibilitesPage';
import CompteRenduPage from './pages/praticien/CompteRenduPage';
import OrdonnancePage from './pages/praticien/OrdonnancePage';

// Pages Patient
import PatientPriseRdvPage from './pages/patient/PriseRdvPage';
import MesRendezVousPage from './pages/patient/MesRendezVousPage';
import DossierMedicalPage from './pages/patient/DossierMedicalPage';
import MesOrdonnancesPage from './pages/patient/MesOrdonnancesPage';

// Pages communes
import HomePage from './pages/HomePage';
import NotFoundPage from './pages/NotFoundPage';

// Composants
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import PraticienRoute from './components/PraticienRoute';
import PatientRoute from './components/PatientRoute';

/**
 * Composant principal de l'application
 */
function App() {
  return (
    <AuthProvider>
      <Router>
        <Layout>
          <Routes>
            {/* Routes publiques */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            
            {/* Routes protégées */}
            <Route path="/" element={
              <ProtectedRoute>
                <HomePage />
              </ProtectedRoute>
            } />
            
            <Route path="/profile" element={
              <ProtectedRoute>
                <ProfilePage />
              </ProtectedRoute>
            } />
            
            {/* Routes Praticien */}
            <Route path="/agenda" element={
              <ProtectedRoute>
                <PraticienRoute>
                  <PraticienAgendaPage />
                </PraticienRoute>
              </ProtectedRoute>
            } />
            
            <Route path="/disponibilites" element={
              <ProtectedRoute>
                <PraticienRoute>
                  <PraticienDisponibilitesPage />
                </PraticienRoute>
              </ProtectedRoute>
            } />
            
            <Route path="/rendezvous/:rdvId/compte-rendu" element={
              <ProtectedRoute>
                <PraticienRoute>
                  <CompteRenduPage />
                </PraticienRoute>
              </ProtectedRoute>
            } />
            
            <Route path="/rendezvous/:rdvId/ordonnance" element={
              <ProtectedRoute>
                <PraticienRoute>
                  <OrdonnancePage />
                </PraticienRoute>
              </ProtectedRoute>
            } />

            <Route path="/patients/:patientId/dossier" element={
              <ProtectedRoute>
                <PraticienRoute>
                  <DossierMedicalPage />
                </PraticienRoute>
              </ProtectedRoute>
            } />
            
            {/* Routes Patient */}
            <Route path="/prise-rdv" element={
              <ProtectedRoute>
                <PatientRoute>
                  <PatientPriseRdvPage />
                </PatientRoute>
              </ProtectedRoute>
            } />
            
            <Route path="/mes-rendezvous" element={
              <ProtectedRoute>
                <PatientRoute>
                  <MesRendezVousPage />
                </PatientRoute>
              </ProtectedRoute>
            } />

            <Route path="/mes-ordonnances" element={
              <ProtectedRoute>
                <PatientRoute>
                  <MesOrdonnancesPage />
                </PatientRoute>
              </ProtectedRoute>
            } />

            <Route path="/dossier-medical" element={
              <ProtectedRoute>
                <PatientRoute>
                  <DossierMedicalPage />
                </PatientRoute>
              </ProtectedRoute>
            } />
            
            {/* 404 */}
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Layout>
      </Router>
    </AuthProvider>
  );
}

export default App;
