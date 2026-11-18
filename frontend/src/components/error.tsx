import { Box, Flex, Spinner } from "@chakra-ui/react";

export default function Error() {
  return (
    <>
      <Flex
        minH="100vh"
        align="center"
        justify="center"
        bg="gray.900"
        color="white"
        px={6}
        textAlign="center"
      >
        <Box>{/* insert error message... */}</Box>
      </Flex>
    </>
  );
}
