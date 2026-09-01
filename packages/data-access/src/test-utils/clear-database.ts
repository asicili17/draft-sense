import { prisma } from "../prisma";

/**
 * Clears the shared integration-test database from relation leaves to roots.
 * Keep this in one place: individual, incomplete cleanup lists can leave rows
 * behind for a later test file and cause misleading P2003 foreign-key errors.
 */
export async function clearDatabase() {
  await prisma.outboxEvent.deleteMany();
  await prisma.simulationRun.deleteMany();
  await prisma.recommendationSnapshot.deleteMany();
  await prisma.draftPick.deleteMany();
  await prisma.userDraftTeamSelection.deleteMany();
  await prisma.draftTeam.deleteMany();
  await prisma.draftSession.deleteMany();

  await prisma.playerProjection.deleteMany();
  await prisma.playerExternalIdentity.deleteMany();
  await prisma.leagueIntegration.deleteMany();
  await prisma.league.deleteMany();
  await prisma.scoringFormat.deleteMany();
  await prisma.projectionDataset.deleteMany();
  await prisma.player.deleteMany();
  await prisma.providerImport.deleteMany();
  await prisma.userPlatformAccount.deleteMany();
  await prisma.user.deleteMany();
}
