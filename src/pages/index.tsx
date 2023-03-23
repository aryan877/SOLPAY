import { Metadata } from '@metaplex-foundation/mpl-token-metadata';
import { FormControl, InputLabel, MenuItem, Select } from '@mui/material';
import AppBar from '@mui/material/AppBar';
import { default as Box } from '@mui/material/Box';
import { default as Button } from '@mui/material/Button';
import Container from '@mui/material/Container';
import CssBaseline from '@mui/material/CssBaseline';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import Toolbar from '@mui/material/Toolbar';
import { default as Typography } from '@mui/material/Typography';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { WalletAdapterNetwork, WalletNotConnectedError } from '@solana/wallet-adapter-base';
import { ConnectionProvider, useConnection, useWallet, WalletProvider } from '@solana/wallet-adapter-react';
import {
    clusterApiUrl,
    Connection,
    GetProgramAccountsFilter,
    Keypair,
    LAMPORTS_PER_SOL,
    PublicKey,
    SystemProgram,
    Transaction,
} from '@solana/web3.js';
import axios from 'axios';
import type { NextPage } from 'next';
import dynamic from 'next/dynamic';
import Head from 'next/head';
import Image from 'next/image';
import React, { FC, ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { default as hstyles } from '../styles/Home.module.css';

const WalletMultiButtonDynamic = dynamic(
    async () => (await import('@solana/wallet-adapter-react-ui')).WalletMultiButton,
    { ssr: false }
);

const Home: NextPage = () => {
    let [lamports, setLamports] = useState(0.1);
    const [walletAddress, setWalletAddress] = useState('');
    const [error, setError] = useState(false);

    const [selectedOption, setSelectedOption] = useState('');

    const handleChange = (event: any) => {
        setSelectedOption(event.target.value);
    };

    const { connection } = useConnection();
    // const connection = new Connection(clusterApiUrl("devnet"))
    const handleAddressChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const address = event.target.value.trim();
        setWalletAddress(address);
        try {
            new PublicKey(address);
            setError(false);
        } catch {
            // Set error state only if input length is not zero
            setError(address.length > 0);
        }
    };
    const { publicKey, sendTransaction } = useWallet();
    useEffect(() => {
        if (!publicKey) return;
        async function getTokenAccounts(wallet: string, solanaConnection: Connection) {
            const filters: GetProgramAccountsFilter[] = [
                {
                    dataSize: 165, //size of account (bytes)
                },
                {
                    memcmp: {
                        offset: 32, //location of our query in the account (bytes)
                        bytes: wallet, //our search criteria, a base58 encoded string
                    },
                },
            ];
            const accounts = await solanaConnection.getParsedProgramAccounts(
                TOKEN_PROGRAM_ID, //new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA")
                { filters: filters }
            );
            console.log(accounts);

            accounts.forEach(async (account, i) => {
                //Parse the account data
                const parsedAccountInfo: any = account.account.data;
                const mintAddress: string = parsedAccountInfo['parsed']['info']['mint'];
                const tokenBalance: number = parsedAccountInfo['parsed']['info']['tokenAmount']['uiAmount'];
                // console.log(`Token Account No. ${i + 1}: ${account.pubkey.toString()}`);
                // console.log(`--Token Balance: ${tokenBalance}`);
                // console.log(`--Mint Address: ${mintAddress}`);
                let mintPubkey = new PublicKey(mintAddress);
                let tokenmetaPubkey = await Metadata.getPDA(mintPubkey);
                const tokenmeta = await Metadata.load(connection, tokenmetaPubkey);
                console.log(tokenmeta);
                // try {
                // } catch (error) {
                //     console.error(error);
                // }
            });
        }
        getTokenAccounts(publicKey.toString(), connection);
    }, [publicKey, connection]);

    const onClick = useCallback(async () => {
        try {
            if (!publicKey) throw new WalletNotConnectedError();

            const balance = await connection.getBalance(publicKey);
            console.log(balance / LAMPORTS_PER_SOL);

            const toPublicKey = new PublicKey('CfZmCPKN4nVYvViMgMg8UR5Fjw7KAfij4GnWS5KsuKvP');
            const transaction = new Transaction().add(
                SystemProgram.transfer({
                    fromPubkey: publicKey,
                    toPubkey: toPublicKey,
                    lamports: 100000000, // 1 SOL = 1 billion lamports
                })
            );
            const signature = await sendTransaction(transaction, connection);
            console.log(signature);
            const latestBlockHash = await connection.getLatestBlockhash();
            const confirm = await connection.confirmTransaction({
                blockhash: latestBlockHash.blockhash,
                lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
                signature: signature,
            });
            console.log(confirm);
        } catch (error) {
            // Handle errors here
            console.error('Transaction failed:', error);
            // You can also display an error message on your React page using state or a library like React Toastify
        }
    }, [connection, publicKey, sendTransaction]);

    return (
        <>
            <CssBaseline />
            <Head>
                <title>SolSEND</title>
                <meta name="description" content="send tokens over solana" />
                <link rel="icon" href="/favicon.ico" />
            </Head>

            <Container>
                <Box>
                    <AppBar position="static">
                        <Toolbar sx={{ display: 'flex', justifyContent: 'space-between' }}>
                            <Typography variant="h3" component="div">
                                SolSEND
                            </Typography>
                            {/* <Button variant="contained">Button</Button> */}
                            {/* <div className={hstyles.walletButtons}> */}
                            <WalletMultiButtonDynamic
                                style={{
                                    backgroundColor: '#48C1F6',
                                    color: '#212121',
                                }}
                            />
                        </Toolbar>
                    </AppBar>

                    <main className={hstyles.main}>
                        <Box
                            display="flex"
                            flexDirection="column"
                            justifyContent="center"
                            alignItems="center"
                            width="80%"
                        >
                            <TextField
                                fullWidth
                                id="outlined-error"
                                label="Receiver Address"
                                variant="outlined"
                                InputProps={{ style: { fontSize: '1.2rem', fontWeight: 'bold' } }}
                                InputLabelProps={{ style: { fontSize: '1.2rem', fontWeight: 'bold' } }}
                                style={{ marginBottom: '2rem' }}
                                value={walletAddress}
                                onChange={handleAddressChange}
                                error={error}
                                helperText={error ? 'Not a valid Solana address' : ''}
                                autoComplete="off"
                            />

                            <FormControl
                                fullWidth
                                style={{ marginBottom: '2rem', fontSize: '1.2rem', fontWeight: 'bold' }}
                            >
                                <InputLabel
                                    id="demo-simple-select-label"
                                    style={{ fontSize: '1.2rem', fontWeight: 'bold' }}
                                >
                                    Pick Token
                                </InputLabel>
                                <Select
                                    labelId="demo-simple-select-label"
                                    id="demo-simple-select"
                                    label="Pick Token"
                                    value={selectedOption}
                                    onChange={handleChange}
                                    style={{ fontSize: '1.2rem', fontWeight: 'bold' }}
                                >
                                    <MenuItem value={10} style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>
                                        Ten
                                    </MenuItem>
                                    <MenuItem value={20} style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>
                                        Twenty
                                    </MenuItem>
                                    <MenuItem value={30} style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>
                                        Thirty
                                    </MenuItem>
                                </Select>
                            </FormControl>

                            <TextField
                                fullWidth
                                id="outlined-error"
                                label="Token Amount"
                                variant="outlined"
                                InputProps={{ style: { fontSize: '1.2rem', fontWeight: 'bold' } }}
                                InputLabelProps={{ style: { fontSize: '1.2rem', fontWeight: 'bold' } }}
                                style={{ marginBottom: '2rem' }}
                                autoComplete="off"
                            />

                            <Button
                                variant="contained"
                                style={{ marginBottom: '2rem', fontSize: '1.2rem', fontWeight: 'bold' }}
                            >
                                Send Tokens
                            </Button>
                        </Box>
                        {/* <div className={hstyles.grid}></div> */}
                    </main>

                    <footer className={hstyles.footer}>
                        <Typography color="white" variant="h6">
                            https://github.com/aryan877
                        </Typography>
                    </footer>
                </Box>
            </Container>
        </>
    );
};

export default Home;
