import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';

import { store } from './app/store';
import { ThemeProvider } from './app/providers/ThemeProvider';
import { FeedbackProvider } from './app/providers/FeedbackProvider';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Provider store={store}>
      <BrowserRouter>
        <ThemeProvider>
          <FeedbackProvider>
            <App />
          </FeedbackProvider>
        </ThemeProvider>
      </BrowserRouter>
    </Provider>
  </StrictMode>,
);
