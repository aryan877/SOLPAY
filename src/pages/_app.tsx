// import { default as CssBaseline, default as CssBaseline } from '@mui/material/CssBaseline';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import {
    GlowWalletAdapter,
    LedgerWalletAdapter,
    PhantomWalletAdapter,
    SlopeWalletAdapter,
    SolflareWalletAdapter,
    SolletExtensionWalletAdapter,
    SolletWalletAdapter,
    TorusWalletAdapter,
    UnsafeBurnerWalletAdapter,
} from '@solana/wallet-adapter-wallets';
import { clusterApiUrl } from '@solana/web3.js';
import type { AppProps } from 'next/app';
import type { FC } from 'react';
import React, { useMemo } from 'react';
require('../styles/globals.css');
// Use require instead of import since order matters
require('@solana/wallet-adapter-react-ui/styles.css');
// Define the custom theme
// Define the dark theme
const theme = createTheme({
    palette: {
        mode: 'dark',
        primary: {
            main: '#48C1F6',
        },
        secondary: {
            main: '#FFB900',
        },
        background: {
            default: '#1E1E1E',
            paper: '#292929',
        },
        text: {
            primary: '#FFFFFF',
            secondary: '#CCCCCC',
        },
    },
});

const App: FC<AppProps> = ({ Component, pageProps }) => {
    // Can be set to 'devnet', 'testnet', or 'mainnet-beta'
    const network = WalletAdapterNetwork.Devnet;

    // You can also provide a custom RPC endpoint
    const endpoint = useMemo(() => clusterApiUrl(network), [network]);
    // https://api.mainnet-beta.solana.com
    const wallets = useMemo(
        () => [
            new LedgerWalletAdapter(),
            new PhantomWalletAdapter(),
            new GlowWalletAdapter(),
            new SlopeWalletAdapter(),
            new SolletExtensionWalletAdapter(),
            new SolletWalletAdapter(),
            new SolflareWalletAdapter({ network }),
            new TorusWalletAdapter(),
        ],
        [network]
    );

    return (
        <ThemeProvider theme={theme}>
            <ConnectionProvider endpoint={endpoint}>
                <WalletProvider wallets={wallets} autoConnect>
                    <WalletModalProvider>
                        <Component {...pageProps} />
                    </WalletModalProvider>
                </WalletProvider>
            </ConnectionProvider>
        </ThemeProvider>
    );
};

export default App;
