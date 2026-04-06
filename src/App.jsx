import { BrowserRouter } from 'react-router';
import AppRoutes from './components/AppRoutes';

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
