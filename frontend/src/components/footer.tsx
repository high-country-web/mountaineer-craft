import { Box, Flex, Link, Text } from "@chakra-ui/react";
import { LuExternalLink } from "react-icons/lu";

export default function Footer() {
  return (
    <Box as="footer" bg="#090909" color="#999999" fontFamily="Arial, Helvetica, sans-serif">
      <Flex
        maxW="1184px"
        mx={{ base: "20px", md: "28px", lg: "auto" }}
        borderTop="1px solid #ffffff16"
        py="25px"
        direction={{ base: "column", md: "row" }}
        justify="space-between"
        gap={{ base: "12px", md: "24px" }}
        fontSize="13px"
        lineHeight="1.8"
      >
        <Box>
          <Text>Mountaineer Craft · A place to build. A place to belong.</Text>
          <Text fontSize="12px">Not affiliated with Mojang or Microsoft.</Text>
        </Box>
        <Text flexShrink={0}>
          Provided by <Link href="https://highcountryweb.dev/" target="_blank" rel="noopener noreferrer" color="#ffcc00" fontWeight="600" aria-label="High Country Web (opens in a new tab)">High Country Web <LuExternalLink aria-hidden="true" /></Link>
        </Text>
      </Flex>
    </Box>
  );
}
