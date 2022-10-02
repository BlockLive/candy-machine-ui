import { web3 } from "@project-serum/anchor";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { Metaplex } from "@metaplex-foundation/js";

export function useMetaplex() {
  const wallet = useWallet();
  const { connection } = useConnection();
  const metaplex = new Metaplex(connection);

  async function findNftByOwner() {
    if (wallet.publicKey === null || connection === null) {
      return;
    }
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

  async function findCollectionMintIdsByOwner() {
    const nfts = await findNftByOwner();
    return (
      nfts
        ?.filter((nft) => nft !== undefined)
        .reduce((result, nft) => {
          const collectionMintId =
            nft?.collection?.address?.toString() as string;
          if (!result.includes(collectionMintId)) {
            result.push(collectionMintId);
          }
          return result;
        }, [] as string[]) ?? []
    );
  }
  return { findCollectionMintIdsByOwner, findNftByOwner };
}
