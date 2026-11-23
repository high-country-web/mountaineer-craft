---
title: Protect Your Builds
description: Create a land claim and share access with GriefPrevention
---

# Protect Your Builds

Mountaineer Craft uses GriefPrevention to protect player builds with land claims. Other players cannot build in or take items from a claim unless the owner gives them permission.

## Create a Claim

1. Hold the claim shovel (a golden shovel by default).
2. Right-click one corner of the area you want to protect.
3. Right-click the opposite corner to set the other end of the claim.

The server will show the claim boundaries. Claims use claim blocks, and the available balance limits how much land you can protect. If the claim tool behaves differently, check with staff because the tool can be configured.

On Mountaineer Craft, a claim also protects the area above and below the marked land, so you do not need to claim the same spot at multiple heights.

## Share Your Claim

Use the command that matches the access you want to give:

| Command | Permission granted |
| --- | --- |
| `/trust <player>` | Full build access in your claim. |
| `/containertrust <player>` | Use containers and other claim features such as crafting blocks and animals, without full build access. |
| `/accesstrust <player>` | Use buttons, levers, and beds. |

Replace `<player>` with the player's Minecraft username. You can check existing permissions with `/trustlist` while standing in the claim. Use `/untrust <player>` to remove permissions you gave that player.

## Other Useful Commands

- `/claimslist` — view your claims and claim-block information.
- `/abandonclaim` — delete the claim you are standing in.
- `/abandonallclaims` — delete all of your claims.

Use the abandon commands carefully: deleting a claim removes its protection. For more details, see the [GriefPrevention command reference](https://docs.griefprevention.com/commands/).
