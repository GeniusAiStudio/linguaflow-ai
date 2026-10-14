
import './error-init';
import React, { ErrorInfo, ReactNode } from 'react';
import ReactDOM from 'react-dom/client';

import App from './App';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends React.Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error in React App:", error, errorInfo);
    this.setState({ errorInfo });
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{
          backgroundColor: '#050505',
          color: '#ef4444',
          padding: '40px',
          fontFamily: 'monospace',
          height: '100vh',
          overflow: 'auto',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px'
        }}>
          <h1 style={{ color: '#ffffff', fontSize: '24px', fontWeight: 'bold' }}>Something went wrong.</h1>
          <p style={{ fontSize: '16px', fontWeight: 'bold', color: '#fca5a5' }}>
            Error: {this.state.error?.toString()}
          </p>
          <pre style={{
            backgroundColor: '#111111',
            padding: '20px',
            borderRadius: '8px',
            border: '1px solid #222222',
            color: '#94a3b8',
            whiteSpace: 'pre-wrap',
            fontSize: '12px',
            lineHeight: '1.5'
          }}>
            {this.state.errorInfo?.componentStack || this.state.error?.stack}
          </pre>
          <button 
            onClick={() => {
              localStorage.clear();
              window.location.reload();
            }}
            style={{
              padding: '12px 24px',
              backgroundColor: '#ef4444',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 'bold',
              alignSelf: 'flex-start'
            }}
          >
            Clear Cache & Reload
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
