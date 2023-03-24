import { Metadata } from '@metaplex-foundation/mpl-token-metadata';
import CodeIcon from '@mui/icons-material/Code';
import LanTwoToneIcon from '@mui/icons-material/LanTwoTone';
import {
    Avatar,
    Backdrop,
    Fade,
    FormControl,
    Grid,
    InputLabel,
    MenuItem,
    Modal,
    Select,
    SelectChangeEvent,
} from '@mui/material';
import MuiAlert, { AlertProps } from '@mui/material/Alert';
import AppBar from '@mui/material/AppBar';
import { default as Box } from '@mui/material/Box';
import { default as Button } from '@mui/material/Button';
import Container from '@mui/material/Container';
import CssBaseline from '@mui/material/CssBaseline';
import Snackbar from '@mui/material/Snackbar';
import TextField from '@mui/material/TextField';
import Toolbar from '@mui/material/Toolbar';
import { default as Typography } from '@mui/material/Typography';
import {
    createAssociatedTokenAccountInstruction,
    createTransferInstruction,
    getAssociatedTokenAddress,
    getOrCreateAssociatedTokenAccount,
    TokenAccountNotFoundError,
    TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import { Strategy, TokenInfo, TokenInfoMap, TokenListContainer, TokenListProvider } from '@solana/spl-token-registry';
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

interface TokenAccount {
    mintAddress: string;
    tokenBalance: number;
    decimals: number;
    uri: string;
    symbol: string;
}

type SeverityType = 'error' | 'success' | 'info';
const SOL = 'SOL';

type StatusType = {
    severity: SeverityType;
    status: 'pending' | 'success' | 'error';
    message: string;
};

const style = {
    position: 'absolute' as 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: 400,
    bgcolor: 'background.paper',
    border: '2px solid #000',
    boxShadow: 24,
    p: 4,
};

const Alert = React.forwardRef<HTMLDivElement, AlertProps>(function Alert(props, ref) {
    return <MuiAlert elevation={6} ref={ref} variant="filled" {...props} />;
});

const Home: NextPage = () => {
    const [status, setStatus] = useState<StatusType>({ severity: 'success', status: 'success', message: '' });
    const [walletAddress, setWalletAddress] = useState<string>('');
    const [walletError, setWalletError] = useState<string>('');
    const [tokenAccounts, setTokenAccounts] = useState<TokenAccount[]>([]);
    const [selectedOption, setSelectedOption] = useState<string>('');
    const [selectedToken, setSelectedToken] = useState<TokenAccount>({
        mintAddress: '',
        symbol: '',
        tokenBalance: 0,
        uri: '',
        decimals: 9,
    });
    const [amount, setAmount] = useState<string>('0');
    const [amountError, setAmountError] = useState<boolean>(false);
    const [selectedTokenChange, setSelectedTokenChange] = useState(false);
    const [signature, setSignature] = useState<string>('');
    const [open, setOpen] = useState<boolean>(false);

    const { publicKey, sendTransaction } = useWallet();
    const { connection } = useConnection();

    useEffect(() => {
        if (!selectedTokenChange) return;
        if (!selectedToken.mintAddress) return;
        const isAmountLessThanBalance = parseFloat(amount) > 0 && parseFloat(amount) <= selectedToken.tokenBalance;
        setAmountError(!isAmountLessThanBalance);
        setSelectedTokenChange(false);
    }, [selectedToken, amount, selectedTokenChange]);

    useEffect(() => {
        setOpen(true);
        return () => {
            setOpen(false);
        };
    }, [status]);

    // useEffect(() => {
    //     if (publicKey && publicKey.toBase58() === walletAddress) {
    //         setWalletError('Cannot send to the same wallet');
    //     } else {
    //         setWalletError('');
    //     }
    // }, [publicKey, walletAddress]);

    useEffect(() => {
        if (!publicKey) return;
        async function getTokenAccounts(wallet: string, connection: Connection) {
            if (publicKey) {
                connection.getBalance(publicKey).then((bal) => {
                    const sol = {
                        symbol: SOL,
                        mintAddress: SOL,
                        uri: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png',
                        tokenBalance: bal / LAMPORTS_PER_SOL,
                        decimals: 9,
                    };
                    setTokenAccounts((prevTokenAccounts) => [...prevTokenAccounts, sol]);
                });
            }
            const provider = new TokenListProvider();
            const tokenList = await provider.resolve();

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
            const accounts = await connection.getParsedProgramAccounts(
                TOKEN_PROGRAM_ID, //new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA")
                { filters: filters }
            );
            const parsedAccounts = await Promise.all(
                accounts.map(async (account) => {
                    try {
                        const parsedAccountInfo: any = account.account.data;
                        const mintAddress: string = parsedAccountInfo['parsed']['info']['mint'];
                        const tokenBalance: number = parsedAccountInfo['parsed']['info']['tokenAmount']['uiAmount'];
                        const decimals: number = parsedAccountInfo['parsed']['info']['tokenAmount']['decimals'];
                        let entry = {};

                        const tokenInfo: TokenInfo | undefined = tokenList
                            .filterByClusterSlug('devnet')
                            .getList()
                            .find((info: TokenInfo) => info.address === mintAddress);

                        entry = { ...entry, mintAddress, tokenBalance, decimals };

                        if (tokenInfo) {
                            entry = { ...entry, uri: tokenInfo?.logoURI, symbol: tokenInfo?.symbol };
                        } else {
                            let mintPubkey = new PublicKey(mintAddress);
                            try {
                                let tokenmetaPubkey = await Metadata.getPDA(mintPubkey);
                                const tokenmeta = await Metadata.load(connection, tokenmetaPubkey);
                                const uri = await axios.get(tokenmeta.data?.data?.uri);
                                entry = {
                                    ...entry,
                                    symbol: tokenmeta.data?.data?.symbol,
                                    uri: uri.data.image,
                                };
                            } catch (error) {
                                entry = { ...entry, uri: '', symbol: mintAddress };
                            }
                        }

                        return entry;
                    } catch (error) {
                        console.error(error);
                    }
                })
            );
            const filteredAccounts = parsedAccounts.filter((account) => account) as TokenAccount[];
            setTokenAccounts((prevTokenAccounts) => [...prevTokenAccounts, ...filteredAccounts]);
        }
        getTokenAccounts(publicKey.toString(), connection);
        return () => {
            setTokenAccounts([]);
        };
    }, [publicKey, connection, signature]);

    const handleChange = (event: SelectChangeEvent<string>, child: React.ReactNode) => {
        setSelectedTokenChange(true);
        setSelectedOption(event.target.value as string);
        const token = tokenAccounts.find((token) => token.mintAddress === event.target.value);
        setSelectedToken(token || { mintAddress: '', symbol: '', tokenBalance: 0, uri: '', decimals: 9 });
    };

    const handleAmountChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const inputAmount = event.target.value.trim();
        if (!inputAmount) {
            setAmountError(true);
            setAmount(inputAmount);
        } else if (!/^(?!0$)\d*(\.\d+)?$/.test(inputAmount)) {
            setAmountError(true);
            setAmount(inputAmount);
        } else {
            const amount = parseFloat(inputAmount);
            if (selectedToken.mintAddress && amount > selectedToken.tokenBalance) {
                setAmountError(true);
            } else {
                setAmountError(false);
            }
            setAmount(inputAmount);
        }
    };

    // const connection = new Connection(clusterApiUrl("devnet"))
    const handleAddressChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const address = event.target.value.trim();
        setWalletAddress(address);
        try {
            new PublicKey(address);
            setWalletError('');
        } catch {
            // Set error state only if input length is not zero
            setWalletError(address.length > 0 ? 'Invalid wallet address' : '');
        }

        // Check if address matches publicKey
        if (publicKey && publicKey.toBase58() === address) {
            setWalletError('Cannot send to the same wallet');
        }
    };

    const handleClose = (event?: React.SyntheticEvent | Event, reason?: string) => {
        if (reason === 'clickaway') {
            return;
        }
        setOpen(false);
    };

    function confirmAction() {
        return new Promise((resolve, reject) => {
            const modalRoot = document.createElement('div');
            modalRoot.style.cssText =
                'position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 9999; display: flex; justify-content: center; align-items: center; background-color: rgba(0, 0, 0, 0.5);';

            const modalContent = document.createElement('div');
            modalContent.style.cssText =
                'background-color: #212121; padding: 24px; border-radius: 8px; width: 50%; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);';

            const message = document.createElement('p');
            message.style.cssText = 'color: #FF0000; margin: 0 0 16px 0; font-size: 1.2rem;';
            message.textContent =
                'The recipient wallet address does not have an account for this token. Would you like to create it for them?';

            const buttonWrapper = document.createElement('div');
            buttonWrapper.style.cssText = 'display: flex; justify-content: flex-end;';

            const confirmButton = document.createElement('button');
            confirmButton.style.cssText =
                'background-color: #48C1F7; color: #1E1E1E; padding: 12px 24px; border-radius: 8px; margin-right: 16px; cursor: pointer; font-size: 1.2rem; border: none; outline: none;';
            confirmButton.textContent = 'Yes';

            const cancelButton = document.createElement('button');
            cancelButton.style.cssText =
                'background-color: #48C1F7; color: #1E1E1E; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-size: 1.2rem; border: none; outline: none;';
            cancelButton.textContent = 'No';

            modalRoot.addEventListener('click', () => {
                reject('Action cancelled.');
                document.body.removeChild(modalRoot);
            });

            modalContent.addEventListener('click', (e) => {
                e.stopPropagation();
            });

            confirmButton.addEventListener('click', () => {
                resolve(true);
                document.body.removeChild(modalRoot);
            });

            cancelButton.addEventListener('click', () => {
                reject('Action cancelled.');
                document.body.removeChild(modalRoot);
            });

            modalContent.appendChild(message);
            buttonWrapper.appendChild(confirmButton);
            buttonWrapper.appendChild(cancelButton);
            modalContent.appendChild(buttonWrapper);
            modalRoot.appendChild(modalContent);
            document.body.appendChild(modalRoot);
        });
    }

    const sendAndConfirmTransaction = async (transaction: any, connection: any) => {
        try {
            const signature = await sendTransaction(transaction, connection);
            setStatus({
                status: 'pending',
                severity: 'info',
                message: `Transaction sent for ID ${signature}!`,
            });
            console.log('Transaction sent:', signature);
            const latestBlockHash = await connection.getLatestBlockhash();
            const confirmation = await connection.confirmTransaction({
                blockhash: latestBlockHash.blockhash,
                lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
                signature: signature,
            });
            if (confirmation) {
                setStatus({
                    status: 'success',
                    severity: 'success',
                    message: `Transaction confirmed for ID ${signature}!`,
                });
                setSignature(signature);
            }
        } catch (error) {
            setStatus({
                status: 'error',
                severity: 'error',
                message: `Transaction failed!`,
            });
        }
    };

    const Transact = async () => {
        //Transaction For SOL Native Token
        if (selectedToken.mintAddress === SOL) {
            try {
                if (!publicKey) throw new WalletNotConnectedError();
                const balance = await connection.getBalance(publicKey);
                console.log(balance / LAMPORTS_PER_SOL);
                const toPublicKey = new PublicKey(walletAddress);
                console.log(parseFloat(amount) * LAMPORTS_PER_SOL);
                const transaction = new Transaction().add(
                    SystemProgram.transfer({
                        fromPubkey: publicKey,
                        toPubkey: toPublicKey,
                        lamports: parseFloat(amount) * LAMPORTS_PER_SOL, // 1 SOL = 1 billion lamports
                    })
                );
                await sendAndConfirmTransaction(transaction, connection);
            } catch (error) {
                setStatus({
                    status: 'error',
                    severity: 'error',
                    message: `Transaction failed!`,
                });
            }
        } else {
            //Transaction For SPL-Token
            try {
                if (!publicKey) throw new WalletNotConnectedError();
                let sourceAccount = await getOrCreateAssociatedTokenAccount(
                    connection,
                    Keypair.generate(),
                    new PublicKey(selectedToken.mintAddress),
                    publicKey
                );
                console.log(`Source Account: ${sourceAccount.address.toString()}`);
                try {
                    let destinationAccount = await getOrCreateAssociatedTokenAccount(
                        connection,
                        Keypair.generate(),
                        new PublicKey(selectedToken.mintAddress),
                        new PublicKey(walletAddress)
                    );
                    console.log(`Destination Account: ${destinationAccount.address.toString()}`);
                    //send transaction directly now
                    const transaction = new Transaction();
                    transaction.add(
                        createTransferInstruction(
                            sourceAccount.address,
                            destinationAccount.address,
                            publicKey,
                            parseFloat(amount) * Math.pow(10, selectedToken.decimals)
                        )
                    );
                    await sendAndConfirmTransaction(transaction, connection);
                } catch (error) {
                    const userConfirmed = await confirmAction();
                    if (!userConfirmed) {
                        throw error;
                    }
                    //else create destination account and then send transaction
                    if (error instanceof TokenAccountNotFoundError) {
                        let ata = await getAssociatedTokenAddress(
                            new PublicKey(selectedToken.mintAddress), // mint
                            new PublicKey(walletAddress), // owner
                            false // allow owner off curve
                        );
                        console.log(`ata: ${ata.toBase58()}`);
                        const tx = new Transaction().add(
                            createAssociatedTokenAccountInstruction(
                                publicKey, // payer
                                ata, // ata
                                new PublicKey(walletAddress), // owner
                                new PublicKey(selectedToken.mintAddress)
                            )
                        );
                        console.log(`create ata txhash: ${await sendTransaction(tx, connection)}`);
                        //create destination account and then send transaction
                        let destinationAccount = await getOrCreateAssociatedTokenAccount(
                            connection,
                            Keypair.generate(),
                            new PublicKey(selectedToken.mintAddress),
                            new PublicKey(walletAddress)
                        );
                        console.log(`Destination Account: ${destinationAccount.address.toString()}`);
                        const transaction = new Transaction();
                        transaction.add(
                            createTransferInstruction(
                                sourceAccount.address,
                                destinationAccount.address,
                                publicKey,
                                parseFloat(amount) * Math.pow(10, selectedToken.decimals)
                            )
                        );
                        await sendAndConfirmTransaction(transaction, connection);
                    }
                }
            } catch (error) {
                setStatus({
                    status: 'error',
                    severity: 'error',
                    message: `Transaction failed!`,
                });
            }
        }
    };

    return (
        <>
            <CssBaseline />
            <Head>
                <title>SOLPAY</title>
                <meta name="description" content="send tokens over solana" />
                <link rel="icon" href="/favicon.ico" />
            </Head>
            <Container>
                <Box>
                    <AppBar position="static">
                        <Toolbar sx={{ display: 'flex', justifyContent: 'space-between' }}>
                            <Typography
                                sx={{
                                    color: '#1E1E1E',
                                    fontWeight: 'bold',
                                    backgroundColor: '#48C1F6',
                                    borderRadius: '5px',
                                }}
                                variant="h3"
                                component="div"
                            >
                                SOLPAY
                            </Typography>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <LanTwoToneIcon style={{ marginRight: '1rem' }} />
                                <Typography sx={{}} variant="h6" component="div">
                                    Devnet Only
                                </Typography>
                            </Box>
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
                                error={walletError.length > 0}
                                helperText={walletError}
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
                                    {tokenAccounts.map((account) => (
                                        <MenuItem
                                            key={account.mintAddress}
                                            value={account.mintAddress}
                                            style={{ fontSize: '1.2rem', fontWeight: 'bold' }}
                                        >
                                            <Grid
                                                spacing={3}
                                                container
                                                sx={{ alignItems: 'center', justify: 'space-between' }}
                                            >
                                                <Grid item xs={1}>
                                                    <Avatar src={account?.uri} alt="" />
                                                </Grid>
                                                <Grid item xs={1}>
                                                    <Typography variant="h6" align="right">
                                                        {account?.symbol.length > 16
                                                            ? account?.symbol.slice(0, 16) + '....'
                                                            : account?.symbol}
                                                    </Typography>
                                                </Grid>
                                                <Grid item xs>
                                                    <Typography variant="h6" align="right">
                                                        {account?.tokenBalance}
                                                    </Typography>
                                                </Grid>
                                            </Grid>
                                        </MenuItem>
                                    ))}
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
                                value={amount}
                                onChange={handleAmountChange}
                                error={amountError}
                                helperText={amountError ? 'Invalid Input' : ''}
                                autoComplete="off"
                            />

                            <Button
                                onClick={(event: React.MouseEvent<HTMLButtonElement>) => Transact()}
                                variant="contained"
                                style={{ marginBottom: '2rem', fontSize: '1.2rem', fontWeight: 'bold' }}
                                disabled={
                                    (walletError ||
                                        amountError ||
                                        !walletAddress.length ||
                                        !selectedToken.mintAddress) as boolean
                                }
                            >
                                Send Tokens
                            </Button>
                        </Box>
                        {/* <div className={hstyles.grid}></div> */}
                    </main>
                    <Snackbar open={open} autoHideDuration={2000} onClose={handleClose}>
                        <div>
                            {status.status === 'error' && status.message && (
                                <Alert
                                    variant="outlined"
                                    onClose={handleClose}
                                    severity={status.severity}
                                    sx={{ width: '100%' }}
                                >
                                    {status.message}
                                </Alert>
                            )}
                            {status.status === 'success' && status.message && (
                                <Alert
                                    variant="outlined"
                                    onClose={handleClose}
                                    severity={status.severity}
                                    sx={{ width: '100%' }}
                                >
                                    {status.message}
                                </Alert>
                            )}
                            {status.status === 'pending' && status.message && (
                                <Alert
                                    variant="outlined"
                                    onClose={handleClose}
                                    severity={status.severity}
                                    sx={{ width: '100%' }}
                                >
                                    {status.message}
                                </Alert>
                            )}
                        </div>
                    </Snackbar>

                    <footer className={hstyles.footer}>
                        <Typography color="white" variant="h6">
                            <a href="https://github.com/aryan877" target="_blank" rel="noopener noreferrer">
                                https://github.com/aryan877
                            </a>
                        </Typography>
                    </footer>
                </Box>
            </Container>
        </>
    );
};

export default Home;
