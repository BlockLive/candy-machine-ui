import { web3 } from "@project-serum/anchor";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { Metaplex, walletAdapterIdentity } from "@metaplex-foundation/js";
import { collectionMintIDsAndTokenAddressPair } from "./types";
import { useMemo } from "react";

export function useMetaplex() {
  const wallet = useWallet();
  const { connection } = useConnection();
  const metaplex = useMemo(() => {
    const metaplex = new Metaplex(connection);
    metaplex.use(walletAdapterIdentity(wallet));
    return metaplex;
  }, [connection, wallet]);
  async function findNftByOwner() {
    if (wallet.publicKey === null || connection === null) {
      return;
    }
    // todo(gtihtina): check if metaplex has get accounts
    const accounts = (
      await connection.getParsedTokenAccountsByOwner(wallet.publicKey, {
        programId: new web3.PublicKey(TOKEN_PROGRAM_ID),
      })
    ).value.filter((account) => {
      const amount = account.account?.data?.parsed?.info?.tokenAmount?.uiAmount;
      const decimals =
        account.account?.data?.parsed?.info?.tokenAmount?.decimals;
      // only grab NFTs
      return decimals === 0 && amount === 1;
    });

    return await Promise.all(
      accounts.map(async (account) => {
        try {
          const mintAddress = new web3.PublicKey(
            account.account?.data?.parsed?.info?.mint
          );
          return await metaplex.nfts().findByMint({ mintAddress }).run();
        } catch (err) {
          // do nothing since we might have NFTs without metadata
          // todo(gtihtina): find out why findAllByMintList isnt working.
          // my guess is it doesnt like the nfts with no metadata
          return;
        }
      })
    );
  }

  async function findCollectionMintIDsAndTokenAddress(
    whiteListMintId: string
  ): Promise<collectionMintIDsAndTokenAddressPair[]> {
    const nfts = (await findNftByOwner())?.filter(
      (nft) =>
        nft !== undefined &&
        (nft?.collection?.address?.toString() as string) == whiteListMintId
    );
    return (
      nfts?.reduce((result, nft) => {
        const collectionMintId = nft?.collection?.address?.toString() as string;
        const pair: collectionMintIDsAndTokenAddressPair = {
          collectionMint: collectionMintId,
          nftMint: nft?.address.toBase58() as string,
        };
        result.push(pair);
        return result;
      }, [] as collectionMintIDsAndTokenAddressPair[]) ?? []
    );
  }

  async function utilizeNft(
    mintAddress: web3.PublicKey
  ): Promise<string | undefined> {
    try {
      console.log(mintAddress.toBase58());
      const { response } = await metaplex.nfts().use({ mintAddress }).run();
      return response.signature;
    } catch (err) {
      console.log("Use failed. Err:", err);
    }
    return;
  }

  return { findCollectionMintIDsAndTokenAddress, findNftByOwner, utilizeNft };
}
