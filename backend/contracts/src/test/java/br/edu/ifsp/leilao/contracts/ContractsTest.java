package br.edu.ifsp.leilao.contracts;

import static org.junit.jupiter.api.Assertions.*;

import java.util.HashSet;
import org.junit.jupiter.api.Test;

class ContractsTest {
    @Test
    void eventTypesAreUniqueAndVersioned() {
        assertEquals(EventTypes.ALL.size(), new HashSet<>(EventTypes.ALL).size());
        assertTrue(EventTypes.ALL.stream().allMatch(t -> t.endsWith(".v1")));
    }

    @Test
    void topicName() {
        assertEquals("auction.events", Topics.AUCTION_EVENTS);
    }
}
