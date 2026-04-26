import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout.js';
import { RequireAuth } from './components/RequireAuth.js';
import { AuthProvider } from './context/AuthContext.js';
import { Home } from './pages/Home.js';
import { Servers } from './pages/Servers.js';
import { ServerDetail } from './pages/ServerDetail.js';
import { NewServer } from './pages/NewServer.js';
import { Search } from './pages/Search.js';
import { Admin } from './pages/Admin.js';
import { Login } from './pages/Login.js';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Layout>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/servers" element={<Servers />} />
            <Route path="/servers/new" element={<RequireAuth><NewServer /></RequireAuth>} />
            <Route path="/servers/:id" element={<ServerDetail />} />
            <Route path="/search" element={<Search />} />
            <Route path="/admin" element={<RequireAuth role="admin"><Admin /></RequireAuth>} />
            <Route path="/login" element={<Login />} />
            <Route path="*" element={
              <div className="flex items-center justify-center h-64">
                <div className="text-center">
                  <h1 className="text-4xl font-bold text-gray-400 mb-4">404</h1>
                  <p className="text-gray-500">Page not found</p>
                </div>
              </div>
            } />
          </Routes>
        </Layout>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
