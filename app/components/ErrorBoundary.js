"use client";

import { Component } from "react";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  static getDerivedStateFromError(error) {
    if (typeof console !== "undefined") console.error("ErrorBoundary caught:", error);
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="p-8 text-sm text-center text-muted">
          <p className="font-medium text-foreground mb-1">Something went wrong.</p>
          <p>Refresh the page to try again.</p>
        </div>
      );
    }
    return this.props.children;
  }
}
