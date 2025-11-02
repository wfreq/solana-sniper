import {
  Connection,
  Transaction,
  Keypair,
  TransactionInstruction,
  PublicKey,
  sendAndConfirmTransaction
} from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, createCloseAccountInstruction, getAssociatedTokenAddress } from "@solana/spl-token";
import bs58 from "bs58";
import fs from "fs";


//RPC CONFIG - Get a free RPC from https://www.helius.dev/ and replace the API key with your own
const RPC_URL = "https://mainnet.helius-rpc.com/?api-key=your_api_key";

//KEYPAIR CONFIG
// Use this for base58 private key (replace with your own)
//const USER_KEYPAIR = Keypair.fromSecretKey(bs58.decode("base58_private_key"));

//Use this for keypair.json (replace with your own)
const USER_KEYPAIR = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync("./id.json", "utf8"))));

const connection = new Connection(RPC_URL,"processed");

const PF_PROGRAM_ID = new PublicKey("6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P");
const FEE_CONFIG = new PublicKey("8Wf5TiAheLUqBrKXeYg2JtAFFMWtKdG2BSFgqUcPVwTt");
const PF_FEE_PROGRAM = new PublicKey("pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ");
const BONDING_CURVE_SEED = Buffer.from([98,111,110,100,105,110,103,45,99,117,114,118,101]);

const GLOBAL_PDA = new PublicKey("4wTV1YmiEkRvAtNtsSGPtUrqRYQMe5SKy2uB4Jjaxnjf");
const FEE_RECIPIENT = new PublicKey("CebN5WGQ4jvEPvsVU4EoHEpgzq1VV7AbicfhtW4xC9iM");
const SYSTEM_PROGRAM_ID = new PublicKey("11111111111111111111111111111111");
const EVENT_AUTHORITY = new PublicKey("Ce6TQqeHC9p8KetsN6JsjHK7UTZk7nasjjnr7XxXp9F1");
const ASSOCIATED_BONDING_CURVE_CONST = Buffer.from([
  6, 221, 246, 225, 215, 101, 161, 147, 217, 203, 225, 70, 206, 235, 121, 172,
  28, 180, 133, 237, 95, 91, 55, 145, 58, 140, 245, 133, 126, 255, 0, 169
]);
const ASSOCIATED_BONDING_CURVE_PROGRAM = new PublicKey(Buffer.from([
  140, 151, 37, 143, 78, 36, 137, 241, 187, 61, 16, 41, 20, 142, 13, 131,
  11, 90, 19, 153, 218, 255, 16, 132, 4, 142, 123, 216, 219, 233, 248, 89
]));



export async function getSPLTokensWithBalances() {

  console.log(`🔍 Scanning wallet ${USER_KEYPAIR.publicKey.toString()} for SPL tokens...`);

  const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
    USER_KEYPAIR.publicKey,
    { programId: TOKEN_PROGRAM_ID }
  );

  console.log(`Found ${tokenAccounts.value.length} token accounts`);

  const tokensWithBalance = tokenAccounts.value.filter(account => {
    const parsedInfo = account.account.data.parsed.info;
    const amount = BigInt(parsedInfo.tokenAmount.amount);
    return amount > 0n;
  });

  console.log(`Found ${tokensWithBalance.length} tokens with balance`);

  const results = await Promise.all(tokensWithBalance.map(async account => {
    const parsedInfo = account.account.data.parsed.info;
    const mint = new PublicKey(parsedInfo.mint);
    const amount = BigInt(parsedInfo.tokenAmount.amount);
    const decimals = parsedInfo.tokenAmount.decimals;

    let tokenName = "Unknown";
    let isPumpToken = false;

    try {

      const [bondingCurvePDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("bonding-curve"), mint.toBuffer()],
        PF_PROGRAM_ID
      );

      const bondingCurveAccount = await connection.getAccountInfo(bondingCurvePDA);

      if (bondingCurveAccount && bondingCurveAccount.owner.equals(PF_PROGRAM_ID)) {
        isPumpToken = true;
        tokenName = `Pump.fun Token`;
      }
    } catch (e) {

    }

    return {
      mint,
      address: account.pubkey,
      amount,
      decimals,
      displayAmount: Number(amount) / Math.pow(10, decimals),
      name: tokenName,
      isPumpToken
    };
  }));

  return results;
}

export async function getPumpFunPDAs(mint: PublicKey) {


 const [bondingCurvePDA] = await PublicKey.findProgramAddress(
   [BONDING_CURVE_SEED, mint.toBuffer()],
   PF_PROGRAM_ID
  );
  const accountInfo = await connection.getAccountInfo(bondingCurvePDA);

  const creatorAddressBytes = accountInfo.data.slice(49, 81); 
  const creatorAddress = new PublicKey(creatorAddressBytes);

  const creatorVaultSeed = Buffer.from([99, 114, 101, 97, 116, 111, 114, 45, 118, 97, 117, 108, 116])
const [creator_vault] = PublicKey.findProgramAddressSync(
  [creatorVaultSeed, creatorAddress.toBuffer()],
  PF_PROGRAM_ID
);

  const [associatedBondingCurvePDA] = await PublicKey.findProgramAddress(
    [
      bondingCurvePDA.toBuffer(),
      ASSOCIATED_BONDING_CURVE_CONST,
      mint.toBuffer()
    ],
    ASSOCIATED_BONDING_CURVE_PROGRAM
  );

  const userATA = await getAssociatedTokenAddress(
    mint,
    USER_KEYPAIR.publicKey
  );

  return {
    bondingCurve: bondingCurvePDA,
    associatedBondingCurve: associatedBondingCurvePDA,
    userATA,
    creator_vault
  };
}


export async function initiateSellOrder(
  mint: PublicKey,
  bondingCurve: PublicKey,
  userATA: PublicKey,
  associatedBondingCurve: PublicKey,
  creator_vault: PublicKey,
  amount: bigint
) {
  console.log(`⚡ Selling Token: ${mint.toBase58()}`);


  const sellInstruction = new TransactionInstruction({
    programId: PF_PROGRAM_ID,
    keys: [
        { pubkey: GLOBAL_PDA, isSigner: false, isWritable: false },
        { pubkey: FEE_RECIPIENT, isSigner: false, isWritable: true },
        { pubkey: mint, isSigner: false, isWritable: false },
        { pubkey: bondingCurve, isSigner: false, isWritable: true },
        { pubkey: associatedBondingCurve, isSigner: false, isWritable: true },
        { pubkey: userATA, isSigner: false, isWritable: true },
        { pubkey: USER_KEYPAIR.publicKey, isSigner: true, isWritable: true },
        { pubkey: SYSTEM_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: creator_vault, isSigner: false, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: EVENT_AUTHORITY, isSigner: false, isWritable: false },
        { pubkey: PF_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: FEE_CONFIG, isSigner: false, isWritable: false },
        { pubkey: PF_FEE_PROGRAM, isSigner: false, isWritable: false },
    ],
    data: Buffer.from(
      Uint8Array.of(
          ...[51, 230, 133, 164, 1, 127, 131, 173], // Sell Instruction Discriminator
          ...new Uint8Array(new BigUint64Array([BigInt(amount)]).buffer), // ✅ Sell Amount
          ...new Uint8Array(new BigUint64Array([BigInt(0)]).buffer) // ✅ Min SOL Price
      )
  )
  });

  const closeATAInstruction = createCloseAccountInstruction(
    userATA,
    USER_KEYPAIR.publicKey,
    USER_KEYPAIR.publicKey
  );

  const transaction = new Transaction();
  transaction.add(sellInstruction);
  transaction.add(closeATAInstruction);

  try {
    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [USER_KEYPAIR],
      { skipPreflight: true }
    );
    console.log(`✅ Transaction Successful: https://solscan.io/tx/${signature}`);
    return signature;
  } catch (error) {
    console.error(`❌ Transaction Failed:`, error);
    throw error;
  }
}


export async function scanAndSellPumpTokens() {
  try {
    const tokens = await getSPLTokensWithBalances();

    const pumpTokens = tokens.filter(token => token.isPumpToken);

    console.log(`Found ${pumpTokens.length} Pump.fun tokens with balance`);

    if (pumpTokens.length === 0) {
      console.log("No Pump.fun tokens found with balance to sell");
      return;
    }

    for (const token of pumpTokens) {
      console.log(`Processing ${token.name} (${token.mint.toString()})`);
      console.log(`Balance: ${token.displayAmount}`);

      try {
        const mintAddress = token.mint.toString();
        const { bondingCurve, associatedBondingCurve, userATA, creator_vault } = await getPumpFunPDAs(new PublicKey(mintAddress));

        await initiateSellOrder(
          new PublicKey(mintAddress), 
          bondingCurve,
          userATA,
          associatedBondingCurve,
          creator_vault,
          token.amount // Sell entire balance
        );

        console.log(`Successfully sold ${token.displayAmount} of ${mintAddress}`);

      } catch (error) {
        console.error(`Error selling token ${token.mint.toString()}:`, error);
      }
    }

    console.log("Completed scan and sell operation");
  } catch (error) {
    console.error("Error in scanAndSellPumpTokens:", error);
  }
}

if (require.main === module) {
  scanAndSellPumpTokens()
    .then(() => process.exit(0))
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
}