import dotenv from 'dotenv';
import express, { Express, Request, Response } from 'express';
import asyncHandler from 'express-async-handler';

dotenv.config();

/**
 * 1) Import required libraries:
 *
 *  - "ethers" helps us create a Wallet object based on a private key, which helps us sign transactions.
 *  - "flair-sdk" provides a contract object with ability to submit meta transactions.
 */
import { Wallet } from "ethers";
import { V1_22_ERC721OneOfOneCollection } from "@0xflair/contracts-registry";
import { IpfsClient } from "@0xflair/ipfs";
import { createFlairContractWithMetaTransactions } from "@0xflair/meta-transactions";

/**
 * 2) Load configurations from environment variables (or any config management you use):
 *
 *  - "chainId" is the numeric ID of the chain where your NFT contract is deployed (1 for Ethereum, 4 for Rinkeby Testnet, 137 for Polygon).
 *  - "flairClientId" unique client ID of your Flair account, used for billing purposes.
 *  - "signer" is created based on private key of the minter wallet, used to sign NFT minting meta transactions.
 *  - "nftCollectionAddress" contract address for your deployed NFT collection on the blockchain.
 */
const chainId = Number(process.env.CONTRACT_CHAIN_ID);
const flairClientId = process.env.FLAIR_CLIENT_ID as string;
const signer = new Wallet(process.env.MINTER_PRIVATE_KEY as string);
const nftCollectionAddress = process.env.NFT_COLLECTION_ADDRESS;

/**
 * 3) Create client instance for the ethers.js-compatible contract augmented with meta transactions.
 *
 * In this example we use one of ready-made presets (ERC721OneOfOneCollection).
 * To use a custom built contract you can manually create the meta transactions client instance (new ).
 */
const nftContract = createFlairContractWithMetaTransactions<V1_22_ERC721OneOfOneCollection>({
  chainId: chainId,
  flairClientId: flairClientId,
  contractFqn: "collections/ERC721/extensions/ERC721OneOfOneMintExtension",
  addressOrName: nftCollectionAddress,
  signer: signer,
});

const ipfsClient = new IpfsClient({
  flairClientId: flairClientId,
});

/**
 * 4) Example endpoints:
 *
 *  - "GET /mint" endpoint simply uploads a new metadata to IPFS and mints a new 1-of-1 NFT based on that metadata.
 */
const app: Express = express();

app.get(
  "/mint",
  asyncHandler(async (req: Request, res: Response) => {
    //
    // A) "to" is the wallet address that receives the new NFT
    //
    const to = "0x8016f96b5cCC4663324E8D117c337BB7aA68d909";

    //
    // B) "count" is the number of NFTs to send to this wallet
    //
    const count = 1;

    //
    // C) Uploading a new metadata to IPFS
    //
    const someRandomId = Math.floor(Math.random() * 10000000000);
    /** @type {import("flair-sdk").NftCollectionMetadata} */
    const nftMetadata = {
      name: `Angel #${someRandomId}`,
      image: `https://my-awesome-site.com/nft/${someRandomId}.png`,
      description: "This is the first NFT in the collection",
      external_link: `https://my-awesome-site.com/nft/${someRandomId}`,
    };
    const tokenOneIpfsHash = await ipfsClient.uploadJson(nftMetadata);

    //
    // D) "tokenURIs" an array with exact size of "count" of metadata URLs for the newly minted NFTs
    //
    const tokenURIs = [`ipfs://${tokenOneIpfsHash}`];

    console.log(``);
    console.log(`Minting ${count} NFTs to ${to}:`);
    console.log(` - TokenURI: ${tokenURIs[0]}`);

    //
    // E) Sign a meta transaction and submit it to the Flair backend relayer for processing
    //
    const data = await nftContract.metaTransaction.mintWithTokenURIsByRole(
      to,
      count,
      tokenURIs
    );

    console.log(` - Signature: ${data.signature}`);
    console.log(` - Transaction is being processed and mined check your contract on EtherScan to see the status...`);
    console.log(``);

    // The response is a successfully submitted (but not yet mined) meta transaction.
    // Note that depending on traffic on the blockchain it might take a few minutes to be mined and processed.
    res.send({
      tokenURIs: tokenURIs,
      nftMetadata: nftMetadata,
      response: data
    });
  })
);

const port = 8080;

app.listen(port, () => {
  console.log(`Flair SDK Example - Mint 1-of-1 NFTs via Meta Transactions!`);
  console.log(`- Listening on port ${port}`);
  console.log(``);
  console.log(`Now you can mint NFTs by opening: http://localhost:${port}/mint`);
});
