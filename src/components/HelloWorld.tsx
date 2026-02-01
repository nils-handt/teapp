import React from 'react';

interface HelloWorldProps {
    name?: string;
}

const HelloWorld: React.FC<HelloWorldProps> = ({ name = 'World' }) => {
    return <div>Hello {name}!</div>;
};

export default HelloWorld;
