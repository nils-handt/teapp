import React from 'react';
import { render, screen } from '@testing-library/react';
import HelloWorld from './HelloWorld';

test('renders default greeting', () => {
    render(<HelloWorld />);
    const linkElement = screen.getByText(/Hello World!/i);
    expect(linkElement).toBeInTheDocument();
});

test('renders personalized greeting', () => {
    render(<HelloWorld name="Jest" />);
    const linkElement = screen.getByText(/Hello Jest!/i);
    expect(linkElement).toBeInTheDocument();
});
