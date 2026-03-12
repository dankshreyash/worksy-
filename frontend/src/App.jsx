import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout/Layout';
import SearchJobs from './pages/SearchJobs/SearchJobs';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<SearchJobs />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
