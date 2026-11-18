import NextLink from "next/link";
import { Box, Button, Flex, Heading, Link, Text } from "@chakra-ui/react";
import { LuArrowRight } from "react-icons/lu";
import { PlayersLayout } from "@/components/players";

const questions = [
  {
    question: "How do I join on Java Edition?",
    answer:
      "Open Minecraft Java Edition, choose Multiplayer, then Add Server. Enter play.mountaineercraft.net as the server address and connect.",
  },
  {
    question: "Can I play on Bedrock Edition?",
    answer:
      "Yes. On PC or mobile, add bedrock.mountaineercraft.net with port 19132. Java and Bedrock players share the community. Console players can find the BedrockTogether link in the joining section on our homepage.",
  },
  {
    question: "What should I do when I first join?",
    answer:
      "You’ll arrive at the hub. Start with the Getting Started guide in our wiki. Useful commands include /wrp hub to return to the hub, /home, and /tpa.",
  },
  {
    question: "Do I need to sign in to use the website?",
    answer:
      "You can browse the homepage, wiki, and player profiles without signing in. Your personal account page requires Discord sign-in and membership in our Discord server.",
  },
  {
    question: "How do I link Minecraft with Discord?",
    answer:
      "DiscordSRV handles account linking. Run /discord link in game and follow the instructions it gives you. Use the same Discord account when signing in to this website.",
  },
  {
    question: "How does the website find my player profile?",
    answer:
      "When available, we suggest a profile using the Discord username collected by Plan. Names can change and analytics can take time to update, so this is a suggestion rather than a verified account link. You can always search the player directory yourself.",
  },
  {
    question: "Why are some player statistics unavailable?",
    answer:
      "The website uses activity recorded by Plan. A statistic can be unavailable if Plan has not supplied it or if the analytics service is temporarily unavailable. An unavailable statistic does not mean the player’s count is zero.",
  },
  {
    question: "Where can I get help connecting?",
    answer:
      "Double-check the server address and, on Bedrock, port 19132. If you still cannot connect, ask in our Discord and include your Minecraft edition, version, and the exact error message.",
  },
];

export default function FAQ() {
  return (
    <PlayersLayout
      title="Frequently asked questions"
      description="Help with joining Mountaineer Craft on Java or Bedrock, Discord account linking, and player profiles."
    >
      <Text color="#ffcc00" fontSize="12px" fontWeight="700" letterSpacing="2px" mb={3}>
        A LITTLE HELP FOR THE ADVENTURE
      </Text>
      <Heading
        as="h1"
        fontFamily="Georgia, serif"
        fontWeight="400"
        fontSize={{ base: "38px", md: "52px" }}
        mb={4}
      >
        Frequently asked questions.
      </Heading>
      <Text color="#aaaaaa" lineHeight="1.8" maxW="620px" mb={8}>
        Everything you need to get connected and find your place in the community.
      </Text>
      <Box maxW="880px">
        {questions.map(({ question, answer }) => (
          <Box
            as="details"
            key={question}
            mb={3}
            border="1px solid #ffffff16"
            bg="#151515"
            rounded="xl"
            css={{
              "& summary": {
                cursor: "pointer",
                padding: "22px 24px",
                fontWeight: 600,
                lineHeight: 1.6,
              },
              "& summary:focus-visible": {
                outline: "3px solid #ffcc00",
                outlineOffset: "4px",
                borderRadius: "12px",
              },
              "&[open] summary": { color: "#ffcc00" },
            }}
          >
            <summary>{question}</summary>
            <Text px={6} pb={6} color="#aaaaaa" lineHeight="1.9">
              {answer}
            </Text>
          </Box>
        ))}
      </Box>
      <Flex wrap="wrap" gap={3} mt={8}>
        <Button asChild bg="#ffcc00" color="#090909" _hover={{ bg: "#ffdb4d" }}>
          <NextLink href="/#join">
            Join the server <LuArrowRight />
          </NextLink>
        </Button>
        <Button asChild variant="outline" borderColor="#ffffff30" color="inherit">
          <NextLink href="/wiki/getting-started">Read the getting started guide</NextLink>
        </Button>
      </Flex>
      <Text color="#aaaaaa" fontSize="14px" lineHeight="1.8" mt={6}>
        Still need a hand?{" "}
        <Link
          href="https://links.mountaineercraft.net/discord"
          target="_blank"
          rel="noopener noreferrer"
          color="#ffcc00"
        >
          Ask the community on Discord.
        </Link>
      </Text>
    </PlayersLayout>
  );
}
